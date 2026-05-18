import { ObjectId } from 'mongodb';

import type { Answer, Evaluation, EvaluationRecord } from './types/evaluation.js';

export function toApiEvaluation(doc: EvaluationRecord & { _id: ObjectId }): Evaluation {
  const evaluationId = doc._id.toString();
  const { _id, ...rest } = doc;

  return {
    id: evaluationId,
    ...normalizeEvaluationRecord(rest, evaluationId),
  };
}

export function parseObjectId(id: string): ObjectId | null {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const objectId = new ObjectId(id);

  if (objectId.toHexString() !== id.toLowerCase()) {
    return null;
  }

  return objectId;
}

export function normalizeEvaluationRecord(
  record: EvaluationRecord,
  evaluationId: string,
): EvaluationRecord {
  return {
    ...record,
    answers: record.answers.map((answer) => normalizeAnswer(answer, evaluationId)),
  };
}

export function normalizeAnswer(answer: Answer, evaluationId: string): Answer {
  return answer.evaluationId === evaluationId ? answer : { ...answer, evaluationId };
}
