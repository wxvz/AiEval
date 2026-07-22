import type { ObjectId } from 'mongodb';

import type { CriteriaMode, EvaluationConfig, RubricCriterion } from './evaluation.js';

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

export type EvaluationTemplateRecord = Omit<EvaluationTemplate, 'id'>;

export type EvaluationTemplateDocument = EvaluationTemplateRecord & { _id: ObjectId };
