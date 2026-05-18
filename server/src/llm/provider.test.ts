import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./ollama.js', () => ({
  createOllamaProvider: vi.fn(),
  isOllamaHealthy: vi.fn(),
}));

vi.mock('./groq.js', () => ({
  createGroqProvider: vi.fn(),
  hasGroqCredentials: vi.fn(),
}));

vi.mock('./openrouter.js', () => ({
  createOpenRouterProvider: vi.fn(),
  hasOpenRouterCredentials: vi.fn(),
}));

vi.mock('./gemini.js', () => ({
  createGeminiProvider: vi.fn(),
  hasGeminiCredentials: vi.fn(),
}));

vi.mock('./huggingface.js', () => ({
  createHuggingFaceProvider: vi.fn(),
  hasHuggingFaceCredentials: vi.fn(),
}));

vi.mock('./model-presets.js', () => ({
  resolveModelsForProvider: vi.fn((name: string) => ({
    answerModels: [{ model: `${name}-answer`, label: 'answer' }],
    judgeModel: { model: `${name}-judge`, label: 'judge' },
  })),
}));

import { hasGeminiCredentials } from './gemini.js';
import { hasGroqCredentials } from './groq.js';
import { hasHuggingFaceCredentials } from './huggingface.js';
import { isOllamaHealthy } from './ollama.js';
import { hasOpenRouterCredentials } from './openrouter.js';
import { probeActiveProvider, probeAllProviders } from './provider.js';

describe('provider probes', () => {
  beforeEach(() => {
    vi.mocked(isOllamaHealthy).mockReset();
    vi.mocked(hasGroqCredentials).mockReset();
    vi.mocked(hasOpenRouterCredentials).mockReset();
    vi.mocked(hasGeminiCredentials).mockReset();
    vi.mocked(hasHuggingFaceCredentials).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('marks providers unavailable when health or credentials fail', async () => {
    vi.mocked(isOllamaHealthy).mockResolvedValue(false);
    vi.mocked(hasGroqCredentials).mockReturnValue(false);
    vi.mocked(hasOpenRouterCredentials).mockReturnValue(false);
    vi.mocked(hasGeminiCredentials).mockReturnValue(false);
    vi.mocked(hasHuggingFaceCredentials).mockReturnValue(false);

    const probes = await probeAllProviders();

    expect(probes).toEqual([
      { name: 'ollama', status: 'unavailable', reason: 'not reachable' },
      { name: 'groq', status: 'unavailable', reason: 'API key not set' },
      { name: 'openrouter', status: 'unavailable', reason: 'API key not set' },
      { name: 'gemini', status: 'unavailable', reason: 'API key not set' },
      { name: 'huggingface', status: 'unavailable', reason: 'API key not set' },
    ]);
    expect(await probeActiveProvider()).toBeNull();
  });

  it('returns the first ready provider in priority order', async () => {
    vi.mocked(isOllamaHealthy).mockResolvedValue(false);
    vi.mocked(hasGroqCredentials).mockReturnValue(true);
    vi.mocked(hasOpenRouterCredentials).mockReturnValue(true);
    vi.mocked(hasGeminiCredentials).mockReturnValue(false);
    vi.mocked(hasHuggingFaceCredentials).mockReturnValue(false);

    const probes = await probeAllProviders();
    const active = await probeActiveProvider();

    expect(probes.find((probe) => probe.name === 'groq')).toEqual({
      name: 'groq',
      status: 'ready',
      answerModels: ['groq-answer'],
      judgeModel: 'groq-judge',
    });
    expect(active).toEqual({
      name: 'groq',
      status: 'ready',
      answerModels: ['groq-answer'],
      judgeModel: 'groq-judge',
    });
  });

  it('prefers ollama when it is healthy', async () => {
    vi.mocked(isOllamaHealthy).mockResolvedValue(true);
    vi.mocked(hasGroqCredentials).mockReturnValue(true);
    vi.mocked(hasOpenRouterCredentials).mockReturnValue(false);
    vi.mocked(hasGeminiCredentials).mockReturnValue(false);
    vi.mocked(hasHuggingFaceCredentials).mockReturnValue(false);

    const active = await probeActiveProvider();

    expect(active).toEqual({
      name: 'ollama',
      status: 'ready',
      answerModels: ['ollama-answer'],
      judgeModel: 'ollama-judge',
    });
  });
});
