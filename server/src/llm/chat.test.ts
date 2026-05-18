import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config.js', () => ({
  config: { llmSlowFallbackMs: 50, llmInterCallDelayMs: 0, llmMaxRetries: 0, llmBackoffBaseMs: 0 },
}));

vi.mock('../logging/logger.js', () => ({
  logEvent: vi.fn(),
  logPromptSnippet: vi.fn(),
}));

vi.mock('./provider.js', () => ({
  resolveFirstCloudProvider: vi.fn(),
}));

import { resolveFirstCloudProvider } from './provider.js';
import { chat } from './chat.js';
import type { LlmProvider, ResolvedLlmSetup } from './types.js';

describe('chat slow fallback', () => {
  const slowProvider: LlmProvider = {
    name: 'ollama',
    complete: (_model, _messages, options) =>
      new Promise((_, reject) => {
        options?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      }),
  };

  const groqProvider: LlmProvider = {
    name: 'groq',
    complete: async () => 'groq-response',
  };

  const ollamaSetup: ResolvedLlmSetup = {
    providerName: 'ollama',
    provider: slowProvider,
    answerModels: [{ model: 'llama3.2:3b', label: 'llama' }],
    judgeModel: { model: 'llama3.1:8b', label: 'judge' },
  };

  const groqSetup: ResolvedLlmSetup = {
    providerName: 'groq',
    provider: groqProvider,
    answerModels: [{ model: 'llama-3.1-8b-instant', label: 'groq' }],
    judgeModel: { model: 'llama-3.3-70b-versatile', label: 'judge' },
  };

  beforeEach(() => {
    vi.mocked(resolveFirstCloudProvider).mockResolvedValue(groqSetup);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('retries on cloud when the user chooses cloud after a slow local response', async () => {
    const onCloudProviderSwitch = vi.fn();

    const result = await chat(slowProvider, 'llama3.2:3b', [{ role: 'user', content: 'hi' }], {
      currentSetup: ollamaSetup,
      requestProviderChoice: async () => true,
      onCloudProviderSwitch,
    });

    expect(result).toBe('groq-response');
    expect(onCloudProviderSwitch).toHaveBeenCalledWith(groqSetup);
  });

  it('retries locally without a timeout when the user keeps Ollama', async () => {
    const fastLocal: LlmProvider = {
      name: 'ollama',
      complete: async () => 'local-response',
    };
    const onPreferLocalProvider = vi.fn();
    let calls = 0;

    const result = await chat(
      {
        name: 'ollama',
        complete: (...args) => {
          calls += 1;

          if (calls === 1) {
            return slowProvider.complete(...args);
          }

          return fastLocal.complete(...args);
        },
      },
      'llama3.2:3b',
      [{ role: 'user', content: 'hi' }],
      {
        currentSetup: ollamaSetup,
        requestProviderChoice: async () => false,
        onPreferLocalProvider,
      },
    );

    expect(result).toBe('local-response');
    expect(onPreferLocalProvider).toHaveBeenCalled();
  });
});
