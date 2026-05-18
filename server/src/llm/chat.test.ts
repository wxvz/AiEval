import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config.js', () => ({
  config: { llmSlowFallbackMs: 50, llmInterCallDelayMs: 0, llmMaxRetries: 0, llmBackoffBaseMs: 0 },
}));

vi.mock('../logging/logger.js', () => ({
  logEvent: vi.fn(),
  logPromptSnippet: vi.fn(),
}));

vi.mock('./provider.js', () => ({
  tryResolveGroq: vi.fn(),
}));

import { tryResolveGroq } from './provider.js';
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
    vi.mocked(tryResolveGroq).mockResolvedValue(groqSetup);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('retries on Groq when the primary provider exceeds the slow threshold', async () => {
    const onGroqFallback = vi.fn();

    const result = await chat(slowProvider, 'llama3.2:3b', [{ role: 'user', content: 'hi' }], {
      currentSetup: ollamaSetup,
      onGroqFallback,
    });

    expect(result).toBe('groq-response');
    expect(onGroqFallback).toHaveBeenCalledWith(groqSetup);
  });
});
