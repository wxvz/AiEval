import type { ObjectId } from 'mongodb';

export interface RubricCriterion {
  id: string;
  name: string;
  description?: string;
  maxPoints: number;
}

export type CriteriaMode = 'default' | 'custom';

export interface Score {
  criterionId: string;
  criterionName: string;
  points: number;
  maxPoints: number;
  notes?: string;
}

export interface Answer {
  id: string;
  evaluationId: string;
  label: string;
  content: string;
  scores: Score[];
  isWinner?: boolean;
}

export interface Evaluation {
  id: string;
  title: string;
  prompt: string;
  criteriaMode?: CriteriaMode;
  rubricId?: string;
  criteria: RubricCriterion[];
  answers: Answer[];
  improvedAnswer?: string;
  winnerAnswerId?: string;
  createdAt: string;
  updatedAt: string;
}

export type EvaluationDocument = Omit<Evaluation, 'id'> & { _id: ObjectId };
