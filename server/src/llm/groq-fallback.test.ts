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
    preset: 'balanced',
  };
}

describe('resolveProviderModelForCall', () => {
  const ollama = mockSetup('ollama', ['llama3.2:3b', 'qwen2.5:3b'], 'llama3.1:8b');
  const groq = mockSetup(
    'groq',
    ['llama-3.1-8b-instant', 'qwen/qwen3.6-27b'],
    'openai/gpt-oss-120b',
  );

  it('maps answer models by index', () => {
    expect(resolveProviderModelForCall(ollama, groq, 'llama3.2:3b')).toBe('llama-3.1-8b-instant');
    expect(resolveProviderModelForCall(ollama, groq, 'qwen2.5:3b')).toBe('qwen/qwen3.6-27b');
  });

  it('maps judge model', () => {
    expect(resolveProviderModelForCall(ollama, groq, 'llama3.1:8b')).toBe('openai/gpt-oss-120b');
  });
});
