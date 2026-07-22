import type { CheckQuestion } from './learn-content';

export function normalizeCheckAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isCheckAnswerCorrect(userInput: string, question: CheckQuestion): boolean {
  const normalized = normalizeCheckAnswer(userInput);
  if (!normalized) {
    return false;
  }
  const targets = [question.answer, ...(question.accept ?? [])].map(normalizeCheckAnswer);
  return targets.includes(normalized);
}
