import { describe, expect, it } from 'vitest';

import {
  allAnswersHaveEqualTotals,
  clampScore,
  normalizeJudgePoints,
  parseJudgePointsValue,
  pickWinner,
  scaleAnswerScores,
} from './scores.js';
import type { Score } from '../types/evaluation.js';

function score(criterionId: string, points: number, maxPoints: number): Score {
  return { criterionId, criterionName: criterionId, points, maxPoints };
}

describe('scores', () => {
  it('clamps points to max', () => {
    expect(clampScore(10, 5)).toBe(5);
    expect(clampScore(-1, 5)).toBe(0);
  });

  it('normalizes percentage-scale judge points', () => {
    expect(normalizeJudgePoints(25, 5)).toBe(1);
    expect(normalizeJudgePoints(80, 100)).toBe(80);
    expect(normalizeJudgePoints(0.8, 5)).toBe(4);
  });

  it('parses string percentages from judge JSON', () => {
    expect(parseJudgePointsValue('25%', 5)).toBe(1);
    expect(parseJudgePointsValue('4', 5)).toBe(4);
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

  it('detects equal totals across answers', () => {
    const answers = [
      { scores: [score('c1', 5, 5), score('c2', 5, 5)] },
      { scores: [score('c1', 5, 5), score('c2', 5, 5)] },
    ];

    expect(allAnswersHaveEqualTotals(answers)).toBe(true);
    expect(allAnswersHaveEqualTotals([answers[0]!])).toBe(false);
  });

  it('scales scores by factor', () => {
    const answer = {
      id: 'a',
      scores: [score('c1', 4, 5), score('c2', 2, 5)],
    };

    const scaled = scaleAnswerScores(answer, 0.5);

    expect(scaled.scores[0]?.points).toBe(2);
    expect(scaled.scores[1]?.points).toBe(1);
  });
});
