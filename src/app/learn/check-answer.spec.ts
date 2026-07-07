import { describe, expect, it } from 'vitest';

import { isCheckAnswerCorrect, normalizeCheckAnswer } from './check-answer';
import type { CheckQuestion } from './learn-content';

const question: CheckQuestion = {
  prompt: 'What is supervised learning?',
  answer: 'Learning from labeled input–target examples.',
  accept: ['learning from examples with targets', 'learning from labeled examples'],
  explanation: 'Supervised learning uses labeled pairs.',
};

describe('normalizeCheckAnswer', () => {
  it('trims, lowercases, and collapses whitespace', () => {
    expect(normalizeCheckAnswer('  Hello   World  ')).toBe('hello world');
  });
});

describe('isCheckAnswerCorrect', () => {
  it('returns false for empty input', () => {
    expect(isCheckAnswerCorrect('   ', question)).toBe(false);
  });

  it('matches canonical answer with normalization', () => {
    expect(isCheckAnswerCorrect('  LEARNING FROM labeled input–target examples. ', question)).toBe(
      true,
    );
  });

  it('matches accept aliases', () => {
    expect(isCheckAnswerCorrect('Learning from labeled examples', question)).toBe(true);
  });

  it('returns false for wrong answer', () => {
    expect(isCheckAnswerCorrect('unsupervised clustering', question)).toBe(false);
  });
});
