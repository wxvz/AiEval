import type { ObjectId } from 'mongodb';

import type { TokenUsageTotals } from './token-usage.js';

export type { TokenUsageTotals };

export interface RubricCriterion {
  id: string;
  name: string;
  description?: string;
  maxPoints: number;
  weight: number;
}

export type CriteriaMode = 'default' | 'custom';

export type TaskDifficulty = 'easy' | 'balanced' | 'hard';
export type EvaluationGoal =
  | 'general'
  | 'coding'
  | 'reasoning'
  | 'grounded'
  | 'safety'
  | 'creative';
export type EvaluationAudience = 'general' | 'beginner' | 'expert' | 'executive';
export type ResponseFormat = 'freeform' | 'paragraphs' | 'bullets' | 'json' | 'code';

export interface EvaluationConfig {
  taskDifficulty: TaskDifficulty;
  goal: EvaluationGoal;
  audience: EvaluationAudience;
  responseConstraints: {
    maxWords?: number;
    format: ResponseFormat;
    requireCitations: boolean;
    requireCode: boolean;
    requireTests: boolean;
  };
  expectedAnswer?: string;
  blindJudging: boolean;
  judgeProfile: {
    strictness: TaskDifficulty;
    model?: string;
  };
}

export interface ManualOverrideRecord {
  kind: 'winner' | 'score';
  answerId: string;
  criterionId?: string;
  priorValue?: string;
  newValue: string;
  reason: string;
  at: string;
}

export interface LastScoringRun {
  at: string;
  judgeModel?: string;
  strictness: TaskDifficulty;
}

export interface Score {
  criterionId: string;
  criterionName: string;
  points: number;
  maxPoints: number;
  notes?: string;
  confidence?: number;
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
  evaluationConfig: EvaluationConfig;
  answers: Answer[];
  improvedAnswer?: ImprovedAnswer;
  winnerAnswerId?: string;
  automatedAt?: string;
  lastScoringRun?: LastScoringRun;
  scoringConfigRevision?: string;
  manualOverrides?: ManualOverrideRecord[];
  tokenUsage?: TokenUsageTotals;
  createdAt: string;
  updatedAt: string;
}

export type EvaluationRecord = Omit<Evaluation, 'id'>;

export type EvaluationDocument = EvaluationRecord & { _id: ObjectId };
