import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as providerModule from '../llm/provider.js';
import type { LlmProvider, ResolvedLlmSetup } from '../llm/types.js';
import {
  answersFromSlots,
  callSingleModelWithFallback,
  isFallbackEligible,
  mapAnswersToSlots,
  pendingSlotIndices,
  type FallbackCandidate,
  validateAnswersForScoring,
} from './resilient-llm.js';

const mockProvider: LlmProvider = { name: 'groq', complete: vi.fn() };

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
    expect(isFallbackEligible(new Error('Invalid JSON'))).toBe(false);
  });
});
