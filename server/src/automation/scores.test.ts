import { describe, expect, it } from 'vitest';

import { clampScore, pickWinner } from './scores.js';
import type { Score } from '../types/evaluation.js';

function score(criterionId: string, points: number, maxPoints: number): Score {
  return { criterionId, criterionName: criterionId, points, maxPoints };
}

describe('scores', () => {
  it('clamps points to max', () => {
    expect(clampScore(10, 5)).toBe(5);
    expect(clampScore(-1, 5)).toBe(0);
  });

  it('picks highest total', () => {
    const winner = pickWinner([
      {
        id: 'a',
        label: 'A',
        scores: [score('c1', 4, 5), score('c2', 4, 5)],
      },
      {
        id: 'b',
        label: 'B',
        scores: [score('c1', 5, 5), score('c2', 5, 5)],
      },
    ]);

    expect(winner?.answerId).toBe('b');
  });

  it('tie-breaks equal totals by percentage', () => {
    const winner = pickWinner([
      {
        id: 'a',
        label: 'A',
        scores: [score('c1', 4, 10)],
      },
      {
        id: 'b',
        label: 'B',
        scores: [score('c1', 4, 8)],
      },
    ]);

    expect(winner?.answerId).toBe('b');
  });

  it('returns null for empty answers', () => {
    expect(pickWinner([])).toBeNull();
  });
});
