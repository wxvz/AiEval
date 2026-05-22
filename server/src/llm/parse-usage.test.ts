import { describe, expect, it } from 'vitest';

import {
  estimateUsage,
  parseGeminiUsage,
  parseOllamaUsage,
  parseOpenAiCompatibleUsage,
} from './parse-usage.js';

describe('parseOpenAiCompatibleUsage', () => {
  it('parses OpenAI-style usage', () => {
    expect(
      parseOpenAiCompatibleUsage({
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }),
    ).toEqual({ promptTokens: 10, completionTokens: 20, totalTokens: 30 });
  });
});

describe('parseGeminiUsage', () => {
  it('parses usageMetadata', () => {
    expect(
      parseGeminiUsage({
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 15,
          totalTokenCount: 20,
        },
      }),
    ).toEqual({ promptTokens: 5, completionTokens: 15, totalTokens: 20 });
  });
});

describe('parseOllamaUsage', () => {
  it('parses prompt_eval_count and eval_count', () => {
    expect(parseOllamaUsage({ prompt_eval_count: 8, eval_count: 12 })).toEqual({
      promptTokens: 8,
      completionTokens: 12,
      totalTokens: 20,
    });
  });
});

describe('estimateUsage', () => {
  it('estimates tokens from message and completion character counts', () => {
    const usage = estimateUsage(
      [{ role: 'user', content: 'abcd' }],
      'efgh',
    );

    expect(usage).toEqual({
      promptTokens: 1,
      completionTokens: 1,
      totalTokens: 2,
      estimated: true,
    });
  });
});
