import { ObjectId } from 'mongodb';

import type { Evaluation, EvaluationRecord, ImprovedAnswer } from './types/evaluation.js';

function normalizeImprovedAnswer(value: unknown): ImprovedAnswer | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? { finalAnswer: trimmed } : undefined;
  }

  if (typeof value === 'object') {
    return value as ImprovedAnswer;
  }

  return undefined;
}

export function toApiEvaluation(doc: EvaluationRecord & { _id: ObjectId }): Evaluation {
  const { _id, improvedAnswer, ...rest } = doc;
  return {
    id: _id.toString(),
    ...rest,
    improvedAnswer: normalizeImprovedAnswer(improvedAnswer),
  };
}

export function parseObjectId(id: string): ObjectId | null {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  return new ObjectId(id);
}
