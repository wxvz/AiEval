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

  it('coerces LLM_JUDGE_MODEL when it matches an answer slot', async () => {
    vi.stubEnv('LLM_ANSWER_MODELS', '');
    vi.stubEnv(
      'LLM_JUDGE_MODEL',
      'groq:llama-3.1-8b-instant',
    );

    const { resolveModelsForProvider } = await import('./model-presets.js');
    const { answerModels, judgeModel } = resolveModelsForProvider('groq');

    expect(answerModels.map((entry) => entry.model)).toContain('llama-3.1-8b-instant');
    expect(judgeModel.model).toBe('openai/gpt-oss-120b');
  });
});

describe('preset judge separation', () => {
  const providers = ['ollama', 'groq', 'openrouter', 'gemini', 'huggingface'] as const;
  const presets = ['balanced', 'fast'] as const;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
    vi.stubEnv('LLM_ANSWER_MODELS', '');
    vi.stubEnv('LLM_JUDGE_MODEL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  for (const preset of presets) {
    for (const provider of providers) {
      it(`${provider} ${preset} judge is not an answer model`, async () => {
        vi.stubEnv('LLM_PRESET', preset);

        const { resolveModelsForProvider } = await import('./model-presets.js');
        const { setLlmPreset } = await import('../runtime-settings.js');

        setLlmPreset(preset);

        const { answerModels, judgeModel } = resolveModelsForProvider(provider);
        const answerIds = answerModels.map((entry) => entry.model);

        expect(answerIds).not.toContain(judgeModel.model);
      });
    }
  }
});
