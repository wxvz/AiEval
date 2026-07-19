import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config.js', () => ({
  config: { groqApiKey: 'test-key' },
}));

const { llmFetch } = vi.hoisted(() => ({
  llmFetch: vi.fn(),
}));

vi.mock('./llm-fetch.js', () => ({ llmFetch }));

import { createGroqProvider, groqReasoningRequestFields, isGroqReasoningModel } from './groq.js';

describe('groq reasoning controls', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('detects Groq reasoning models', () => {
    expect(isGroqReasoningModel('qwen/qwen3.6-27b')).toBe(true);
    expect(isGroqReasoningModel('openai/gpt-oss-20b')).toBe(true);
    expect(isGroqReasoningModel('openai/gpt-oss-120b')).toBe(true);
    expect(isGroqReasoningModel('llama-3.1-8b-instant')).toBe(false);
  });

  it('hides reasoning for Qwen and gpt-oss request bodies', () => {
    expect(groqReasoningRequestFields('qwen/qwen3.6-27b')).toEqual({
      reasoning_format: 'hidden',
    });
    expect(groqReasoningRequestFields('openai/gpt-oss-20b')).toEqual({
      reasoning_format: 'hidden',
    });
    expect(groqReasoningRequestFields('llama-3.1-8b-instant')).toEqual({});
  });

  it('sends reasoning_format hidden and uses only message.content', async () => {
    llmFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'Final three paragraphs about distribution centers.',
              reasoning: 'All constraints met. Self-Correction/Verification during thought...',
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }),
    });

    const provider = createGroqProvider();
    const result = await provider.complete('qwen/qwen3.6-27b', [
      { role: 'user', content: 'Explain the trade-off.' },
    ]);

    expect(result.text).toBe('Final three paragraphs about distribution centers.');

    const body = JSON.parse(llmFetch.mock.calls[0]![1].body as string) as Record<string, unknown>;
    expect(body.reasoning_format).toBe('hidden');
    expect(body.model).toBe('qwen/qwen3.6-27b');
  });

  it('omits reasoning_format for non-reasoning models', async () => {
    llmFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'hi' } }],
      }),
    });

    const provider = createGroqProvider();
    await provider.complete('llama-3.1-8b-instant', [{ role: 'user', content: 'hi' }]);

    const body = JSON.parse(llmFetch.mock.calls[0]![1].body as string) as Record<string, unknown>;
    expect(body.reasoning_format).toBeUndefined();
  });
});
