import { ObjectId } from 'mongodb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EvaluationDocument } from '../types/evaluation.js';

const updateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });

vi.mock('../db.js', () => ({
  getEvaluationsCollection: () => ({ updateOne }),
}));

const { AutomationError, prepareDocForPhase } = await import('./run-evaluation.js');

function baseDoc(overrides: Partial<EvaluationDocument> = {}): EvaluationDocument {
  return {
    _id: new ObjectId(),
    title: 'Test',
    prompt: 'Hello',
    criteriaMode: 'default',
    criteria: [],
    answers: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('prepareDocForPhase', () => {
  beforeEach(() => {
    updateOne.mockClear();
  });

  it('throws for generate when answers exist without force', async () => {
    const doc = baseDoc({
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
