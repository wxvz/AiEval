import { describe, expect, it } from 'vitest';

import { resolveProviderModelForCall } from './groq-fallback.js';
import type { ResolvedLlmSetup } from './types.js';

function mockSetup(
  providerName: ResolvedLlmSetup['providerName'],
  answerModels: string[],
  judgeModel: string,
): ResolvedLlmSetup {
  return {
    providerName,
    provider: { name: providerName, complete: async () => ({ text: '' }) },
    answerModels: answerModels.map((model) => ({ model, label: model })),
    judgeModel: { model: judgeModel, label: judgeModel },
  };
}

describe('resolveProviderModelForCall', () => {
  const ollama = mockSetup('ollama', ['llama3.2:3b', 'qwen2.5:3b'], 'llama3.1:8b');
  const groq = mockSetup(
    'groq',
    ['llama-3.1-8b-instant', 'meta-llama/llama-4-scout-17b-16e-instruct'],
    'llama-3.3-70b-versatile',
  );

  it('maps answer models by index', () => {
    expect(resolveProviderModelForCall(ollama, groq, 'llama3.2:3b')).toBe('llama-3.1-8b-instant');
    expect(resolveProviderModelForCall(ollama, groq, 'qwen2.5:3b')).toBe(
      'meta-llama/llama-4-scout-17b-16e-instruct',
    );
  });

  it('maps judge model', () => {
    expect(resolveProviderModelForCall(ollama, groq, 'llama3.1:8b')).toBe('llama-3.3-70b-versatile');
  });
});
