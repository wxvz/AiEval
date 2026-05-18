import { describe, expect, it } from 'vitest';

import { DEFAULT_CRITERIA } from './criteria.js';
import {
  allAnswersHaveEqualTotals,
  clampScore,
  normalizeJudgePoints,
  parseJudgePointsValue,
  parseJudgeScoreResponse,
  pickWinner,
  scaleAnswerScores,
  snapToAnchorPoints,
  snapToBuiltInAnchors,
} from './scores.js';
import type { RubricCriterion, Score } from '../types/evaluation.js';

const criteria: RubricCriterion[] = [
  { id: 'c1', name: 'Accuracy', maxPoints: 5 },
  { id: 'c2', name: 'Clarity', maxPoints: 5 },
];

function score(criterionId: string, points: number, maxPoints: number): Score {
  return { criterionId, criterionName: criterionId, points, maxPoints };
}

describe('scores', () => {
  it('clamps points to max', () => {
    expect(clampScore(10, 5)).toBe(5);
    expect(clampScore(-1, 5)).toBe(0);
  });

  it('normalizes percentage-scale judge points', () => {
    const anchors = [1, 3, 5];

    expect(normalizeJudgePoints(25, 5, anchors)).toBe(1);
    expect(normalizeJudgePoints(80, 100)).toBe(80);
    expect(normalizeJudgePoints(0.8, 5, anchors)).toBe(3);
    expect(normalizeJudgePoints(0.8, 5)).toBe(4);
    expect(normalizeJudgePoints(4, 5)).toBe(4);
  });

  it('snaps to listed anchor points', () => {
    expect(snapToAnchorPoints(4, 5, [1, 3, 5])).toBe(3);
    expect(snapToAnchorPoints(2, 5, [1, 3, 5])).toBe(1);
    expect(snapToAnchorPoints(5, 5, [1, 3, 5])).toBe(5);
    expect(snapToBuiltInAnchors(4, 5)).toBe(4);
    expect(parseJudgePointsValue(4, 5, [1, 3, 5])).toBe(3);
    expect(parseJudgePointsValue(2, 5, [1, 3, 5])).toBe(1);
  });

  it('clamps five-point scores without snapping when no anchors apply', () => {
    expect(snapToAnchorPoints(4, 5)).toBe(4);
    expect(snapToAnchorPoints(2, 5)).toBe(2);
    expect(parseJudgePointsValue(4, 5)).toBe(4);
    expect(parseJudgePointsValue(2, 5)).toBe(2);
  });

  it('parses string percentages from judge JSON with anchors', () => {
    const anchors = [1, 3, 5];

    expect(parseJudgePointsValue('25%', 5, anchors)).toBe(1);
    expect(parseJudgePointsValue('4', 5, anchors)).toBe(3);
    expect(parseJudgePointsValue('5', 5, anchors)).toBe(5);
  });

  it('keeps default-rubric judge scores on the 1–5 ladder', () => {
    const parsed = parseJudgeScoreResponse(
      {
        scores: [
          { criterionId: 'default-accuracy', points: 4 },
          { criterionId: 'default-clarity', points: 2 },
        ],
      },
      DEFAULT_CRITERIA.slice(0, 2),
      [],
    );

    expect(parsed.scores[0]?.points).toBe(4);
    expect(parsed.scores[1]?.points).toBe(2);
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

  it('parses judge scores with per-criterion and answer notes', () => {
    const parsed = parseJudgeScoreResponse(
      {
        answerNotes: 'Strong overall; minor clarity gaps.',
        scores: [
          { criterionId: 'c1', points: 4, notes: 'Mostly correct.' },
          { criterionId: 'c2', points: 3, notes: 'Readable but dense.' },
        ],
      },
      criteria,
      [],
    );

    expect(parsed.answerNotes).toBe('Strong overall; minor clarity gaps.');
    expect(parsed.scores[0]?.points).toBe(4);
    expect(parsed.scores[0]?.notes).toBe('Mostly correct.');
    expect(parsed.scores[1]?.notes).toBe('Readable but dense.');
  });

  it('preserves existing criterion notes when judge omits them', () => {
    const existing: Score[] = [
      {
        criterionId: 'c1',
        criterionName: 'Accuracy',
        points: 0,
        maxPoints: 5,
        notes: 'Prior note',
      },
    ];

    const parsed = parseJudgeScoreResponse(
      {
        scores: [{ criterionId: 'c1', points: 4 }],
      },
      [criteria[0]!],
      existing,
    );

    expect(parsed.scores[0]?.points).toBe(4);
    expect(parsed.scores[0]?.notes).toBe('Prior note');
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
