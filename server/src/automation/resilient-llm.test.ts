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
  preset: 'balanced',
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

describe('buildFallbackCandidates answer role', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('excludes sibling answer-slot models from answer fallback candidates', async () => {
    vi.spyOn(providerModule, 'isProviderAvailable').mockResolvedValue(false);
    vi.spyOn(modelPresetsModule, 'resolveSingleModel').mockImplementation(
      (_provider, role, slot, preset) => {
        if (role === 'answer' && slot === 0 && preset === 'fast') {
          // Fast fallback for slot 0 intentionally collides with slot 1 primary.
          return 'model-b';
        }

        if (role === 'answer') {
          return ['model-a', 'model-b', 'model-c'][slot] ?? 'model-a';
        }

        return 'judge';
      },
    );

    const candidates = await buildFallbackCandidates(setup, 'answer', 0);

    expect(candidates.map((candidate) => candidate.model)).toEqual(['model-a']);
  });

  it('maps cross-provider fallbacks with setup.preset, not live overlay', async () => {
    const { setLlmPreset, resetLlmPresetToEnvDefault } = await import('../runtime-settings.js');
    const logger = await import('../logging/logger.js');
    const { LogEvents } = await import('../logging/events.js');
    const logSpy = vi.spyOn(logger, 'logEvent');

    setLlmPreset('fast');
    vi.spyOn(providerModule, 'isProviderAvailable').mockImplementation(
      async (name) => name === 'openrouter',
    );
    const resolveSpy = vi.spyOn(modelPresetsModule, 'resolveSingleModel').mockImplementation(
      (provider, role, slot, preset) => {
        if (role === 'answer') {
          return `${provider}-${preset}-slot-${slot}`;
        }

        return `${provider}-${preset}-judge`;
      },
    );

    try {
      const frozenSetup: ResolvedLlmSetup = { ...setup, preset: 'balanced' };
      await buildFallbackCandidates(frozenSetup, 'answer', 0);

      const openrouterAnswerCalls = resolveSpy.mock.calls.filter(
        ([provider, role]) => provider === 'openrouter' && role === 'answer',
      );

      expect(openrouterAnswerCalls.length).toBeGreaterThan(0);
      expect(openrouterAnswerCalls.every(([, , , preset]) => preset === 'balanced')).toBe(true);
      expect(logSpy).toHaveBeenCalledWith(
        'debug',
        LogEvents.llmPresetMismatch,
        expect.objectContaining({
          preset: 'balanced',
          livePreset: 'fast',
        }),
      );
    } finally {
      resetLlmPresetToEnvDefault();
    }
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
      preset: 'balanced',
    };

    const candidates = await buildFallbackCandidates(groqSetup, 'judge', 0);

    expect(candidates.map((candidate) => candidate.model)).toEqual(['openai/gpt-oss-120b']);
  });

  it('throws a clear error when no judge candidates remain', async () => {
    vi.spyOn(providerModule, 'isProviderAvailable').mockResolvedValue(false);
    vi.spyOn(modelPresetsModule, 'resolveSingleModel').mockReturnValue('model-a');

    const collapsedSetup: ResolvedLlmSetup = {
      ...setup,
      judgeModel: { model: 'model-a', label: 'A' },
    };

    await expect(buildFallbackCandidates(collapsedSetup, 'judge', 0)).rejects.toThrow(
      /No eligible judge fallback candidates/i,
    );
  });
});

describe('buildFallbackCandidates abort', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws Automation cancelled when signal aborts during provider probing', async () => {
    const controller = new AbortController();
    vi.spyOn(providerModule, 'isProviderAvailable').mockImplementation(async () => {
      controller.abort();
      return true;
    });
    vi.spyOn(modelPresetsModule, 'resolveSingleModel').mockImplementation(
      (provider, role, slot, preset) => `${provider}-${role}-${slot}-${preset}`,
    );

    await expect(
      buildFallbackCandidates(setup, 'answer', 0, controller.signal),
    ).rejects.toThrow(/Automation cancelled/);
  });
});

describe('mapAnswersToSlots slot identity', () => {
  it('prefers explicit slotIndex over label when remapping checkpoint answers', () => {
    const slots = mapAnswersToSlots(
      [
        {
          id: '1',
          evaluationId: 'e',
          // Label matches slot 1, but this answer belongs in slot 0 (fallback remapped label).
          label: 'B',
          content: 'fallback-for-slot-0',
          scores: [],
          slotIndex: 0,
          provider: 'openrouter',
          model: 'openrouter/free',
        },
      ],
      setup,
    );

    expect(slots[0]?.content).toBe('fallback-for-slot-0');
    expect(slots[1]).toBeNull();
    expect(slots[2]).toBeNull();
  });

  it('logs when extra answers cannot claim a free slot', async () => {
    const logger = await import('../logging/logger.js');
    const { LogEvents } = await import('../logging/events.js');
    const logSpy = vi.spyOn(logger, 'logEvent');

    const slots = mapAnswersToSlots(
      [
        { id: '1', evaluationId: 'e', label: 'A', content: 'one', scores: [] },
        { id: '2', evaluationId: 'e', label: 'B', content: 'two', scores: [] },
        { id: '3', evaluationId: 'e', label: 'C', content: 'three', scores: [] },
        { id: '4', evaluationId: 'e', label: 'Extra', content: 'four', scores: [] },
      ],
      setup,
    );

    expect(answersFromSlots(slots)).toHaveLength(3);
    expect(logSpy).toHaveBeenCalledWith(
      'warn',
      LogEvents.automationAnswerRejected,
      expect.objectContaining({
        droppedAnswerIds: ['4'],
        droppedLabels: ['Extra'],
      }),
    );

    logSpy.mockRestore();
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
    expect(onModelFallback).toHaveBeenCalledWith('openrouter/free', 'gemini-2.0-flash', undefined, 'failed');
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
      'rate_limit',
    );
  });

  it('maps AbortError to cancelled when signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      callSingleModelWithFallback(
        candidates,
        {},
        undefined,
        async () => {
          throw new DOMException('The operation was aborted.', 'AbortError');
        },
        undefined,
        controller.signal,
      ),
    ).rejects.toThrow(/Automation cancelled/);
  });

  it('falls back after invalid judge JSON', async () => {
    const tried: string[] = [];

    const result = await callSingleModelWithFallback(
      candidates,
      {},
      undefined,
      async (_provider, model) => {
        tried.push(model);

        if (model === 'llama-3.3-70b-versatile') {
          throw new Error('Invalid batch scores JSON');
        }

        return `ok:${model}`;
      },
    );

    expect(result).toBe('ok:llama-3.1-8b-instant');
    expect(tried).toEqual(['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']);
  });
});

describe('isFallbackEligible', () => {
  it('treats 429 and fetch failed as eligible for fallback', () => {
    expect(isFallbackEligible(new Error('429 rate limit'))).toBe(true);
    expect(isFallbackEligible(new Error('fetch failed'))).toBe(true);
    expect(isFallbackEligible(new Error('Answer qwen3.6-27b has empty content.'))).toBe(true);
    expect(
      isFallbackEligible(new Error('Answer qwen3.6-27b has empty content (sanitized empty).')),
    ).toBe(true);
    expect(isFallbackEligible(new Error('sanitized empty'))).toBe(true);
    expect(isFallbackEligible(new Error('Invalid JSON'))).toBe(true);
  });

  it('treats provider HTTP 404 and 5xx as eligible', () => {
    expect(
      isFallbackEligible(new Error('OpenRouter request failed: 404 — Provider returned error')),
    ).toBe(true);
    expect(isFallbackEligible(new Error('Gemini request failed: 502'))).toBe(true);
    expect(isFallbackEligible(new Error('Hugging Face request failed: 503'))).toBe(true);
  });

  it('treats judge/batch JSON parse failures as eligible', () => {
    expect(isFallbackEligible(new Error('Unexpected end of JSON input'))).toBe(true);
    expect(isFallbackEligible(new Error('Invalid improved answer JSON'))).toBe(true);
    expect(isFallbackEligible(new Error('Invalid batch scores JSON'))).toBe(true);
    expect(isFallbackEligible(new SyntaxError('Unexpected token'))).toBe(true);
  });

  it('does not treat auth errors as eligible', () => {
    expect(isFallbackEligible(new Error('OpenRouter request failed: 401 — Unauthorized'))).toBe(
      false,
    );
    expect(isFallbackEligible(new Error('Gemini request failed: 403'))).toBe(false);
  });
});
