import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('resolveModelsForProvider', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
    vi.stubEnv('LLM_ANSWER_MODELS', 'ollama:model-a,ollama:model-b,');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('ignores empty segments in LLM_ANSWER_MODELS', async () => {
    const { resolveModelsForProvider } = await import('./model-presets.js');
    const { answerModels } = resolveModelsForProvider('ollama');

    expect(answerModels.map((entry) => entry.model)).toEqual(['model-a', 'model-b']);
  });
});
