import { ObjectId } from 'mongodb';

import type { Evaluation, EvaluationRecord } from './types/evaluation.js';

export function toApiEvaluation(doc: EvaluationRecord & { _id: ObjectId }): Evaluation {
  const { _id, ...rest } = doc;
  return {
    id: _id.toString(),
    ...rest,
  };
}

export function parseObjectId(id: string): ObjectId | null {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  return new ObjectId(id);
}
