import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config.js', () => ({
  config: {
    openRouterApiKey: 'test-key',
    openRouterHttpReferer: 'http://localhost:4200',
    openRouterAppTitle: 'AiEval',
  },
}));

vi.mock('./llm-fetch.js', () => ({
  llmFetch: vi.fn(),
}));

import { llmFetch } from './llm-fetch.js';
import { createOpenRouterProvider } from './openrouter.js';

function mockOpenRouterResponse(body: unknown, status = 200): Awaited<ReturnType<typeof llmFetch>> {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Awaited<ReturnType<typeof llmFetch>>;
}

describe('createOpenRouterProvider', () => {
  beforeEach(() => {
    vi.mocked(llmFetch).mockReset();
  });

  it('returns text without resolvedModel when response model matches request', async () => {
    vi.mocked(llmFetch).mockResolvedValue(
      mockOpenRouterResponse({
        model: 'meta-llama/llama-3.2-3b-instruct:free',
        choices: [{ message: { content: 'hello' } }],
        usage: { prompt_tokens: 4, completion_tokens: 6, total_tokens: 10 },
      }),
    );

    const provider = createOpenRouterProvider();
    const result = await provider.complete('meta-llama/llama-3.2-3b-instruct:free', [
      { role: 'user', content: 'hi' },
    ]);

    expect(result).toEqual({
      text: 'hello',
      usage: { promptTokens: 4, completionTokens: 6, totalTokens: 10 },
    });
  });

  it('includes resolvedModel when OpenRouter routes to a different model', async () => {
    vi.mocked(llmFetch).mockResolvedValue(
      mockOpenRouterResponse({
        model: 'meta-llama/llama-3.2-3b-instruct:free',
        choices: [{ message: { content: 'routed' } }],
      }),
    );

    const provider = createOpenRouterProvider();
    const result = await provider.complete('openrouter/free', [{ role: 'user', content: 'hi' }]);

    expect(result).toEqual({
      text: 'routed',
      resolvedModel: 'meta-llama/llama-3.2-3b-instruct:free',
    });
  });

  it('omits resolvedModel when response model field is empty', async () => {
    vi.mocked(llmFetch).mockResolvedValue(
      mockOpenRouterResponse({
        choices: [{ message: { content: 'no-model-field' } }],
      }),
    );

    const provider = createOpenRouterProvider();
    const result = await provider.complete('openrouter/free', [{ role: 'user', content: 'hi' }]);

    expect(result).toEqual({ text: 'no-model-field' });
  });
});
