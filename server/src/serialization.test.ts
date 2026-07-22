import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';

import { normalizeAnswer, parseObjectId, toApiEvaluation } from './serialization.js';
import type { Answer, EvaluationRecord } from './types/evaluation.js';

describe('parseObjectId', () => {
  it('accepts canonical hex ids', () => {
    const id = new ObjectId().toHexString();
    expect(parseObjectId(id)?.toHexString()).toBe(id);
  });

  it('rejects non-hex ids', () => {
    expect(parseObjectId('not-an-object-id')).toBeNull();
  });

  it('rejects ids that normalize differently', () => {
    expect(parseObjectId('507f1f77bcf86cd7994390111')).toBeNull();
  });
});

describe('normalizeAnswer', () => {
  it('rewrites mismatched evaluationId on answers', () => {
    const evaluationId = new ObjectId().toHexString();
    const answer: Answer = {
      id: 'answer-1',
      evaluationId: 'stale-id',
      label: 'A',
      content: 'text',
      scores: [],
    };

    expect(normalizeAnswer(answer, evaluationId).evaluationId).toBe(evaluationId);
  });
});

describe('toApiEvaluation', () => {
  it('uses document _id as api id and normalizes nested answers', () => {
    const objectId = new ObjectId();
    const record = {
      title: 'Test',
      prompt: 'Prompt',
      criteriaMode: 'default',
      criteria: [{ id: 'legacy', name: 'Legacy', maxPoints: 5 }],
      answers: [
        {
          id: 'answer-1',
          evaluationId: 'wrong',
          label: 'A',
          content: 'text',
          scores: [],
        },
      ],
      createdAt: 'now',
      updatedAt: 'now',
    } as unknown as EvaluationRecord;

    const api = toApiEvaluation({ _id: objectId, ...record });

    expect(api.id).toBe(objectId.toHexString());
    expect(api.answers[0]?.evaluationId).toBe(objectId.toHexString());
    expect(api.evaluationConfig.taskDifficulty).toBe('balanced');
    expect(api.evaluationConfig.goal).toBe('general');
    expect(api.criteria[0]?.weight).toBe(1);
  });
});
