import { describe, expect, it } from 'vitest';

import { resolveGroqModelForCall } from './groq-fallback.js';
import type { ResolvedLlmSetup } from './types.js';

function mockSetup(
  providerName: ResolvedLlmSetup['providerName'],
  answerModels: string[],
  judgeModel: string,
): ResolvedLlmSetup {
  return {
    providerName,
    provider: { name: providerName, complete: async () => '' },
    answerModels: answerModels.map((model) => ({ model, label: model })),
    judgeModel: { model: judgeModel, label: judgeModel },
  };
}

describe('resolveGroqModelForCall', () => {
  const ollama = mockSetup('ollama', ['llama3.2:3b', 'qwen2.5:3b'], 'llama3.1:8b');
  const groq = mockSetup('groq', ['llama-3.1-8b-instant', 'gemma2-9b-it'], 'llama-3.3-70b-versatile');

  it('maps answer models by index', () => {
    expect(resolveGroqModelForCall(ollama, groq, 'llama3.2:3b')).toBe('llama-3.1-8b-instant');
    expect(resolveGroqModelForCall(ollama, groq, 'qwen2.5:3b')).toBe('gemma2-9b-it');
  });

  it('maps judge model', () => {
    expect(resolveGroqModelForCall(ollama, groq, 'llama3.1:8b')).toBe('llama-3.3-70b-versatile');
  });
});
