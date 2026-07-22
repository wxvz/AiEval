import {
  CriteriaMode,
  EvaluationConfig,
  RubricCriterion,
} from './evaluation.model';

export interface EvaluationTemplate {
  id: string;
  name: string;
  title: string;
  prompt: string;
  criteriaMode: CriteriaMode;
  criteria: RubricCriterion[];
  evaluationConfig: EvaluationConfig;
  createdAt: string;
  updatedAt: string;
}

export type CreateEvaluationTemplateDto = Pick<
  EvaluationTemplate,
  'name' | 'title' | 'prompt' | 'criteriaMode' | 'criteria' | 'evaluationConfig'
>;

export interface EvaluationRunEstimate {
  answerCount: number;
  criteriaCount: number;
  phases: string[];
  estimatedTokensMin: number;
  estimatedTokensMax: number;
  estimatedDurationSecondsMin: number;
  estimatedDurationSecondsMax: number;
  costUsd: null;
}
