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

  it('uses only models matching the active provider', async () => {
    vi.stubEnv('LLM_ANSWER_MODELS', 'ollama:model-a,groq:model-b');

    const { resolveModelsForProvider } = await import('./model-presets.js');

    expect(resolveModelsForProvider('ollama').answerModels.map((entry) => entry.model)).toEqual([
      'model-a',
    ]);
    expect(resolveModelsForProvider('groq').answerModels.map((entry) => entry.model)).toEqual([
      'model-b',
    ]);
  });

  it('applies bare model ids to any provider', async () => {
    vi.stubEnv('LLM_ANSWER_MODELS', 'shared-model');

    const { resolveModelsForProvider } = await import('./model-presets.js');

    expect(resolveModelsForProvider('groq').answerModels.map((entry) => entry.model)).toEqual([
      'shared-model',
    ]);
  });
});
