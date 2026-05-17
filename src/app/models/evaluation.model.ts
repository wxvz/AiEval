import { Answer } from './answer.model';

export interface RubricCriterion {
  id: string;
  name: string;
  description?: string;
  maxPoints: number;
}

export interface Evaluation {
  id: string;
  title: string;
  prompt: string;
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
    'title' | 'prompt' | 'criteria' | 'answers' | 'improvedAnswer' | 'winnerAnswerId'
  >
>;
