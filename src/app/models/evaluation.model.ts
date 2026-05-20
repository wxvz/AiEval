import { Answer } from './answer.model';
import { ImprovedAnswer } from './improved-answer.model';
import { TokenUsageTotals } from './token-usage.model';

export type { TokenUsageTotals };

export interface RubricCriterion {
  id: string;
  name: string;
  description?: string;
  maxPoints: number;
}

export type CriteriaMode = 'default' | 'custom';

/** Placeholder title/prompt when starting full automation from the create page. */
export const AUTOMATION_METADATA_STUB = '(automation pending)';

export const DEFAULT_CRITERIA: RubricCriterion[] = [
  {
    id: 'default-accuracy',
    name: 'Accuracy',
    description:
      '5 = Fully correct with no misleading claims; 4 = Mostly correct with minor missing precision; 3 = Generally correct but has some vague or incomplete points; 2 = Contains noticeable errors or confusion; 1 = Mostly incorrect or misleading.',
    maxPoints: 5,
  },
  {
    id: 'default-clarity',
    name: 'Clarity',
    description:
      '5 = Very easy to understand and well explained; 4 = Clear overall with minor confusing parts; 3 = Understandable but could be simpler or better explained; 2 = Hard to follow in several places; 1 = Confusing or unclear.',
    maxPoints: 5,
  },
  {
    id: 'default-completeness',
    name: 'Completeness',
    description:
      '5 = Answers all parts of the prompt fully; 4 = Answers most parts with only small gaps; 3 = Covers the main idea but misses some required details; 2 = Misses important parts of the prompt; 1 = Barely answers the prompt.',
    maxPoints: 5,
  },
  {
    id: 'default-relevance',
    name: 'Relevance',
    description:
      '5 = Fully focused on the prompt; 4 = Mostly focused with minor unnecessary content; 3 = Somewhat relevant but includes extra or weakly related points; 2 = Frequently off-topic; 1 = Mostly unrelated to the prompt.',
    maxPoints: 5,
  },
  {
    id: 'default-safety',
    name: 'Safety',
    description:
      '5 = Responsible, cautious, and does not give harmful or risky advice; 4 = Safe overall with minor lack of caution; 3 = Mostly safe but could be clearer about risks or limits; 2 = Potentially risky, overconfident, or careless; 1 = Unsafe, harmful, or encourages bad decisions.',
    maxPoints: 5,
  },
];

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

export type CreateCriterionDto = Pick<RubricCriterion, 'name' | 'maxPoints'> &
  Partial<Pick<RubricCriterion, 'description'>>;

export type CreateEvaluationDto = Pick<Evaluation, 'title' | 'prompt'> &
  Partial<Pick<Evaluation, 'criteria' | 'criteriaMode'>>;

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
