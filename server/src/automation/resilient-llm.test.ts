import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as providerModule from '../llm/provider.js';
import * as modelPresetsModule from '../llm/model-presets.js';
import type { LlmProvider, ResolvedLlmSetup } from '../llm/types.js';
import {
  answersFromSlots,
  buildFallbackCandidates,
  callSingleModelWithFallback,
  chatWithModelFallback,
  isFallbackEligible,
  mapAnswersToSlots,
  pendingSlotIndices,
  type FallbackCandidate,
  validateAnswersForScoring,
} from './resilient-llm.js';

const mockProvider: LlmProvider = { name: 'groq', complete: vi.fn() };

const { chat } = vi.hoisted(() => ({
  chat: vi.fn(),
}));

vi.mock('../llm/chat.js', () => ({ chat }));

const setup: ResolvedLlmSetup = {
  providerName: 'groq',
  provider: { name: 'groq', complete: vi.fn() } as ResolvedLlmSetup['provider'],
  answerModels: [
    { model: 'model-a', label: 'A' },
    { model: 'model-b', label: 'B' },
    { model: 'model-c', label: 'C' },
  ],
  judgeModel: { model: 'judge', label: 'Judge' },
};

describe('resilient-llm helpers', () => {
  it('maps existing answers to slots by label', () => {
    const slots = mapAnswersToSlots(
      [
        {
          id: '1',
          evaluationId: 'e',
          label: 'A',
          content: 'one',
          scores: [],
        },
        {
          id: '2',
          evaluationId: 'e',
          label: 'C',
          content: 'three',
          scores: [],
        },
      ],
      setup,
    );

    expect(slots[0]?.content).toBe('one');
    expect(slots[1]).toBeNull();
    expect(slots[2]?.content).toBe('three');
    expect(pendingSlotIndices(slots)).toEqual([1]);
    expect(answersFromSlots(slots)).toHaveLength(2);
  });

  it('leaves slots pending when existing answers have empty content', () => {
    const slots = mapAnswersToSlots(
      [
        {
          id: '1',
          evaluationId: 'e',
          label: 'A',
          content: '   ',
          scores: [],
        },
        {
          id: '2',
          evaluationId: 'e',
          label: 'B',
          content: 'ok',
          scores: [],
        },
      ],
      setup,
    );

    expect(slots[0]).toBeNull();
    expect(slots[1]?.content).toBe('ok');
    expect(pendingSlotIndices(slots)).toEqual([0, 2]);
  });

  it('validateAnswersForScoring rejects empty content', () => {
    expect(() =>
      validateAnswersForScoring(
        [
          {
            id: '1',
            evaluationId: 'e',
            label: 'A',
            content: '   ',
            scores: [],
          },
        ],
        [],
        3,
      ),
    ).toThrow(/empty content/i);
  });
});

describe('chatWithModelFallback', () => {
  beforeEach(() => {
    vi.spyOn(providerModule, 'createLlmProvider').mockReturnValue(mockProvider);
    vi.spyOn(providerModule, 'isProviderAvailable').mockResolvedValue(false);
    chat.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to the next judge candidate after rate limit', async () => {
    vi.spyOn(providerModule, 'isProviderAvailable').mockImplementation(async (name) => name === 'openrouter');

    chat
      .mockRejectedValueOnce(new Error('Groq request failed: 429 — rate limited'))
      .mockResolvedValueOnce({ text: 'Generated title' });

    const result = await chatWithModelFallback(
      {
        ...setup,
        judgeModel: { model: 'openai/gpt-oss-120b', label: 'gpt-oss-120b' },
      },
      'judge',
      0,
      {},
      [{ role: 'user', content: 'title' }],
      { step: 'generating' },
    );

    expect(result.text).toBe('Generated title');
    expect(chat).toHaveBeenCalledTimes(2);
    expect(chat.mock.calls[0]?.[1]).toBe('openai/gpt-oss-120b');
    expect(chat.mock.calls[1]?.[1]).toBe('meta-llama/llama-3.3-70b-instruct:free');
  });
});

describe('buildFallbackCandidates judge role', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('excludes answer slot models from judge fallback candidates', async () => {
    vi.spyOn(providerModule, 'isProviderAvailable').mockResolvedValue(false);
    vi.spyOn(modelPresetsModule, 'resolveSingleModel').mockImplementation(
      (_provider, role, _slot, preset) => {
        if (role === 'judge' && preset === 'fast') {
          // Intentionally an answer-slot model so judge fallback must skip it.
          return 'llama-3.1-8b-instant';
        }

        return 'openai/gpt-oss-120b';
      },
    );

    const groqSetup: ResolvedLlmSetup = {
      providerName: 'groq',
      provider: mockProvider,
      answerModels: [
        { model: 'llama-3.1-8b-instant', label: 'instant' },
        { model: 'qwen/qwen3.6-27b', label: 'qwen3.6' },
        { model: 'openai/gpt-oss-20b', label: 'gpt-oss-20b' },
      ],
      judgeModel: { model: 'openai/gpt-oss-120b', label: 'gpt-oss-120b' },
    };

    const candidates = await buildFallbackCandidates(groqSetup, 'judge', 0);

    expect(candidates.map((candidate) => candidate.model)).toEqual(['openai/gpt-oss-120b']);
  });
});

describe('callSingleModelWithFallback', () => {
  beforeEach(() => {
    vi.spyOn(providerModule, 'createLlmProvider').mockReturnValue(mockProvider);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const candidates: FallbackCandidate[] = [
    { providerName: 'groq', model: 'llama-3.3-70b-versatile', label: 'versatile' },
    { providerName: 'groq', model: 'llama-3.1-8b-instant', label: 'instant' },
    { providerName: 'openrouter', model: 'openrouter/free', label: 'free' },
  ];

  it('uses the first candidate when skipKeys is omitted', async () => {
    const tried: string[] = [];

    const result = await callSingleModelWithFallback(
      candidates,
      {},
      undefined,
      async (_provider, model) => {
        tried.push(model);
        return `ok:${model}`;
      },
    );

    expect(result).toBe('ok:llama-3.3-70b-versatile');
    expect(tried).toEqual(['llama-3.3-70b-versatile']);
  });

  it('skips only keys listed in skipKeys (generate retry semantics)', async () => {
    const tried: string[] = [];

    const result = await callSingleModelWithFallback(
      candidates,
      {},
      undefined,
      async (_provider, model) => {
        tried.push(model);
        return `ok:${model}`;
      },
      new Set(['groq:llama-3.3-70b-versatile']),
    );

    expect(result).toBe('ok:llama-3.1-8b-instant');
    expect(tried).toEqual(['llama-3.1-8b-instant']);
  });

  it('falls back after rate limit on the primary judge model', async () => {
    const tried: string[] = [];

    const result = await callSingleModelWithFallback(
      candidates,
      {},
      undefined,
      async (_provider, model) => {
        tried.push(model);

        if (model === 'llama-3.3-70b-versatile') {
          throw new Error('Groq request failed: 429 — rate limited');
        }

        return `ok:${model}`;
      },
    );

    expect(result).toBe('ok:llama-3.1-8b-instant');
    expect(tried).toEqual(['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']);
  });

  it('falls back after transient fetch failure', async () => {
    const tried: string[] = [];

    const result = await callSingleModelWithFallback(
      candidates,
      {},
      undefined,
      async (_provider, model) => {
        tried.push(model);

        if (model === 'llama-3.3-70b-versatile') {
          throw new Error('fetch failed');
        }

        return `ok:${model}`;
      },
    );

    expect(result).toBe('ok:llama-3.1-8b-instant');
    expect(tried).toEqual(['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']);
  });

  it('falls back from openrouter 404 to next candidate', async () => {
    const tried: string[] = [];
    const onModelFallback = vi.fn();
    const fourCandidates: FallbackCandidate[] = [
      ...candidates,
      { providerName: 'gemini', model: 'gemini-2.0-flash', label: 'flash' },
    ];

    const result = await callSingleModelWithFallback(
      fourCandidates,
      { onModelFallback },
      undefined,
      async (_provider, model) => {
        tried.push(model);

        if (model === 'openrouter/free') {
          throw new Error('OpenRouter request failed: 404 — Provider returned error');
        }

        return `ok:${model}`;
      },
      new Set(['groq:llama-3.3-70b-versatile', 'groq:llama-3.1-8b-instant']),
    );

    expect(result).toBe('ok:gemini-2.0-flash');
    expect(tried).toEqual(['openrouter/free', 'gemini-2.0-flash']);
    expect(onModelFallback).toHaveBeenCalledWith('openrouter/free', 'gemini-2.0-flash', undefined);
  });

  it('emits onModelFallback when switching candidates', async () => {
    const onModelFallback = vi.fn();

    await callSingleModelWithFallback(
      candidates,
      { onModelFallback },
      undefined,
      async (_provider, model) => {
        if (model === 'llama-3.3-70b-versatile') {
          throw new Error('429');
        }

        return 'ok';
      },
    );

    expect(onModelFallback).toHaveBeenCalledWith(
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      undefined,
    );
  });
});

describe('isFallbackEligible', () => {
  it('treats 429 and fetch failed as eligible for fallback', () => {
    expect(isFallbackEligible(new Error('429 rate limit'))).toBe(true);
    expect(isFallbackEligible(new Error('fetch failed'))).toBe(true);
    expect(isFallbackEligible(new Error('Answer qwen3.6-27b has empty content.'))).toBe(true);
    expect(isFallbackEligible(new Error('Invalid JSON'))).toBe(false);
  });

  it('treats provider HTTP 404 and 5xx as eligible', () => {
    expect(
      isFallbackEligible(new Error('OpenRouter request failed: 404 — Provider returned error')),
    ).toBe(true);
    expect(isFallbackEligible(new Error('Gemini request failed: 502'))).toBe(true);
    expect(isFallbackEligible(new Error('Hugging Face request failed: 503'))).toBe(true);
  });

  it('does not treat auth or JSON errors as eligible', () => {
    expect(isFallbackEligible(new Error('OpenRouter request failed: 401 — Unauthorized'))).toBe(
      false,
    );
    expect(isFallbackEligible(new Error('Gemini request failed: 403'))).toBe(false);
    expect(isFallbackEligible(new Error('Unexpected end of JSON input'))).toBe(false);
    expect(isFallbackEligible(new Error('Invalid improved answer JSON'))).toBe(false);
  });
});
