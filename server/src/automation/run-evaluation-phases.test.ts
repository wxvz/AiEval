import { ObjectId } from 'mongodb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getActiveCriteria } from './criteria.js';
import { initialScoresForCriteria } from './scores.js';
import type { EvaluationDocument } from '../types/evaluation.js';
import { DEFAULT_EVALUATION_CONFIG } from '../evaluation-config.js';

const { updateOne, resolveProvider } = vi.hoisted(() => ({
  updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  resolveProvider: vi.fn(),
}));

vi.mock('../db.js', () => ({
  getEvaluationsCollection: () => ({ updateOne }),
}));
vi.mock('../llm/provider.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../llm/provider.js')>();

  return {
    ...actual,
    resolveProvider,
  };
});

import { AutomationError, prepareDocForPhase } from './run-evaluation.js';

const mockSetup = {
  providerName: 'groq' as const,
  provider: { name: 'groq' as const, complete: vi.fn() },
  answerModels: [
    { model: 'm1', label: 'M1' },
    { model: 'm2', label: 'M2' },
    { model: 'm3', label: 'M3' },
  ],
  judgeModel: { model: 'judge', label: 'Judge' },
};

function baseDoc(overrides: Partial<EvaluationDocument> = {}): EvaluationDocument {
  return {
    _id: new ObjectId(),
    title: 'Test',
    prompt: 'Hello',
    criteriaMode: 'default',
    criteria: [],
    evaluationConfig: DEFAULT_EVALUATION_CONFIG,
    answers: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('prepareDocForPhase', () => {
  beforeEach(() => {
    updateOne.mockClear();
    resolveProvider.mockResolvedValue(mockSetup);
  });

  it('allows generate resume when fewer answers than expected models', async () => {
    const doc = baseDoc();
    const criteria = getActiveCriteria(doc.criteriaMode, doc.criteria);
    const docWithPartial = baseDoc({
      answers: [
        {
          id: 'a1',
          evaluationId: 'eval',
          label: 'M1',
          content: 'Hi',
          scores: initialScoresForCriteria(criteria),
        },
      ],
    });

    const result = await prepareDocForPhase(docWithPartial, 'generate', false);

    expect(result.answers).toHaveLength(1);
  });

  it('throws for generate when all answer slots are filled without force', async () => {
    const doc = baseDoc({
      answers: [
        { id: 'a1', evaluationId: 'eval', label: 'M1', content: 'One', scores: [] },
        { id: 'a2', evaluationId: 'eval', label: 'M2', content: 'Two', scores: [] },
        { id: 'a3', evaluationId: 'eval', label: 'M3', content: 'Three', scores: [] },
      ],
    });

    await expect(prepareDocForPhase(doc, 'generate', false)).rejects.toThrow(AutomationError);
  });

  it('throws for score when there are no answers', async () => {
    await expect(prepareDocForPhase(baseDoc(), 'score', false)).rejects.toThrow(AutomationError);
  });

  it('throws for score when already scored without force', async () => {
    const doc = baseDoc({
      automatedAt: '2020-01-01T00:00:00.000Z',
      answers: [
        {
          id: 'a1',
          evaluationId: 'eval',
          label: 'M1',
          content: 'Hi',
          scores: [],
        },
      ],
    });

    await expect(prepareDocForPhase(doc, 'score', false)).rejects.toThrow(AutomationError);
  });

  it('clears stale improved output when scoring with force', async () => {
    const doc = baseDoc({
      automatedAt: '2020-01-01T00:00:00.000Z',
      winnerAnswerId: 'a1',
      improvedAnswer: { finalAnswer: 'Stale answer' },
      answers: [
        {
          id: 'a1',
          evaluationId: 'eval',
          label: 'M1',
          content: 'Hi',
          scores: [],
          isWinner: true,
        },
      ],
    });

    const result = await prepareDocForPhase(doc, 'score', true);

    expect(result.improvedAnswer).toBeUndefined();
    expect(updateOne).toHaveBeenCalledWith(
      { _id: doc._id },
      expect.objectContaining({
        $unset: expect.objectContaining({ improvedAnswer: '' }),
      }),
    );
  });

  it('throws for improved when there is no winner', async () => {
    await expect(prepareDocForPhase(baseDoc(), 'improved', false)).rejects.toThrow(AutomationError);
  });

  it('throws for improved when improved answer exists without force', async () => {
    const doc = baseDoc({
      winnerAnswerId: 'a1',
      improvedAnswer: { finalAnswer: 'Better answer' },
      answers: [
        {
          id: 'a1',
          evaluationId: 'eval',
          label: 'M1',
          content: 'Hi',
          scores: [],
          isWinner: true,
        },
      ],
    });

    await expect(prepareDocForPhase(doc, 'improved', false)).rejects.toThrow(AutomationError);
  });

  it('clears answers on generate force', async () => {
    const doc = baseDoc({
      winnerAnswerId: 'a1',
      answers: [
        {
          id: 'a1',
          evaluationId: 'eval',
          label: 'M1',
          content: 'Hi',
          scores: [],
        },
      ],
    });

    const result = await prepareDocForPhase(doc, 'generate', true);

    expect(updateOne).toHaveBeenCalled();
    expect(result.answers).toEqual([]);
  });
});
