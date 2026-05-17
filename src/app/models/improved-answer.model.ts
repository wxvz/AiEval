export interface ImprovedAnswer {
  winningAnswer?: string;
  strengths?: string;
  weaknesses?: string;
  usefulFromOthers?: string;
  finalAnswer?: string;
}

export const EMPTY_IMPROVED_ANSWER: ImprovedAnswer = {
  winningAnswer: '',
  strengths: '',
  weaknesses: '',
  usefulFromOthers: '',
  finalAnswer: '',
};
