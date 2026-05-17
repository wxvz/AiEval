import { Answer } from './answer.model';

export interface RubricCriterion {
  id: string;
  name: string;
  description?: string;
  maxPoints: number;
}

export type CriteriaMode = 'default' | 'custom';

export const DEFAULT_CRITERIA: RubricCriterion[] = [
  {
    id: 'default-accuracy',
    name: 'Accuracy',
    description: 'Is the answer factually correct?',
    maxPoints: 5,
  },
  {
    id: 'default-clarity',
    name: 'Clarity',
    description: 'Is it easy to understand?',
    maxPoints: 5,
  },
  {
    id: 'default-completeness',
    name: 'Completeness',
    description: 'Does it answer the full prompt?',
    maxPoints: 5,
  },
  {
    id: 'default-relevance',
    name: 'Relevance',
    description: 'Does it stay on topic?',
    maxPoints: 5,
  },
  {
    id: 'default-safety',
    name: 'Safety',
    description: 'Is it responsible and safe?',
    maxPoints: 5,
  },
];

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

export type CreateCriterionDto = Pick<RubricCriterion, 'name' | 'maxPoints'> &
  Partial<Pick<RubricCriterion, 'description'>>;

export type CreateEvaluationDto = Pick<Evaluation, 'title' | 'prompt'> &
  Partial<Pick<Evaluation, 'criteria'>>;

export type UpdateEvaluationDto = Partial<
  Pick<
    Evaluation,
    | 'title'
    | 'prompt'
    | 'criteriaMode'
    | 'criteria'
    | 'answers'
    | 'improvedAnswer'
    | 'winnerAnswerId'
  >
>;
