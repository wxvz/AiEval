import { Score } from './score.model';

export interface Answer {
  id: string;
  evaluationId: string;
  label: string;
  content: string;
  scores: Score[];
  isWinner?: boolean;
  notes?: string;
}

export type CreateAnswerDto = Pick<Answer, 'label' | 'content'>;
