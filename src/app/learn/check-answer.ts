import type { CheckQuestion } from './learn-content';

/** Wordle-style placement for a word-bank assembly against the canonical answer. */
export type WordPlacement = 'correct' | 'wrong-place' | 'absent';

export function normalizeCheckAnswer(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,!?;:"'()[\]—–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isCheckAnswerCorrect(userInput: string, question: CheckQuestion): boolean {
  const normalized = normalizeCheckAnswer(userInput);
  if (!normalized) {
    return false;
  }
  const targets = [question.answer, ...(question.accept ?? [])].map(normalizeCheckAnswer);
  return targets.includes(normalized);
}

/**
 * Grades each assembled word against the canonical answer tokens.
 * Green = right slot; yellow = in the answer elsewhere; red = not in the answer.
 * Duplicate target tokens are consumed (Wordle-style) so extras mark absent.
 */
export function gradeWordBankAssembly(
  assembledWords: readonly string[],
  targetAnswer: string,
): WordPlacement[] {
  const target = normalizeCheckAnswer(targetAnswer).split(' ').filter(Boolean);
  const guess = assembledWords.map((word) => normalizeCheckAnswer(word));
  const result: WordPlacement[] = guess.map(() => 'absent');
  const used = target.map(() => false);

  for (let i = 0; i < guess.length; i++) {
    if (i < target.length && guess[i] === target[i]) {
      result[i] = 'correct';
      used[i] = true;
    }
  }

  for (let i = 0; i < guess.length; i++) {
    if (result[i] === 'correct') {
      continue;
    }
    const matchIndex = target.findIndex((token, j) => !used[j] && token === guess[i]);
    if (matchIndex >= 0) {
      result[i] = 'wrong-place';
      used[matchIndex] = true;
    }
  }

  return result;
}
