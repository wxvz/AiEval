import type { ObjectId } from 'mongodb';

import type { TokenUsageTotals } from './token-usage.js';

export type { TokenUsageTotals };

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

export interface ImprovedAnswer {
  winningAnswer?: string;
  strengths?: string;
  weaknesses?: string;
  usefulFromOthers?: string;
  finalAnswer?: string;
}

export interface Answer {
  id: string;
  evaluationId: string;
  label: string;
  content: string;
  scores: Score[];
  isWinner?: boolean;
  notes?: string;
}

export interface Evaluation {
  id: string;
  title: string;
  prompt: string;
  criteriaMode: CriteriaMode;
  criteria: RubricCriterion[];
  answers: Answer[];
  improvedAnswer?: ImprovedAnswer;
  winnerAnswerId?: string;
  automatedAt?: string;
  tokenUsage?: TokenUsageTotals;
  createdAt: string;
  updatedAt: string;
}

export type EvaluationRecord = Omit<Evaluation, 'id'>;

export type EvaluationDocument = EvaluationRecord & { _id: ObjectId };
