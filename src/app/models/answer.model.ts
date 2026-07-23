import { Score } from './score.model';

export interface Answer {
  id: string;
  evaluationId: string;
  label: string;
  content: string;
  scores: Score[];
  isWinner?: boolean;
  notes?: string;
  /** Provider that produced this answer (automation generate / resume). */
  provider?: string;
  /** Model id that produced this answer (may differ from preset after fallback). */
  model?: string;
  /** Intended answer slot index for checkpoint remapping. */
  slotIndex?: number;
}

export type CreateAnswerDto = Pick<Answer, 'label' | 'content'>;
