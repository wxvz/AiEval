import { RubricCriterion, Score, upsertCriterionScore } from '../../models';
import {
  activeScoresForCriteria,
  nextAnswerIndex,
  previousAnswerIndex,
} from './compare-answers-page';

describe('upsertCriterionScore', () => {
  const criterion: RubricCriterion = {
    id: 'criterion-accuracy',
    name: 'Accuracy',
    maxPoints: 5,
    weight: 1,
  };

  const inactiveScore: Score = {
    criterionId: 'criterion-inactive',
    criterionName: 'Inactive criterion',
    points: 4,
    maxPoints: 10,
  };

  it('creates a score when no score exists for the criterion', () => {
    const scores = upsertCriterionScore([], criterion, 3);

    expect(scores).toEqual([
      {
        criterionId: criterion.id,
        criterionName: criterion.name,
        points: 3,
        maxPoints: criterion.maxPoints,
      },
    ]);
  });

  it('updates an existing score for the same criterion', () => {
    const existing: Score = {
      criterionId: criterion.id,
      criterionName: criterion.name,
      points: 2,
      maxPoints: criterion.maxPoints,
    };

    const scores = upsertCriterionScore([existing], criterion, 4);

    expect(scores).toEqual([
      {
        criterionId: criterion.id,
        criterionName: criterion.name,
        points: 4,
        maxPoints: criterion.maxPoints,
      },
    ]);
  });

  it('preserves scores from inactive criteria', () => {
    const scores = upsertCriterionScore([inactiveScore], criterion, 3);

    expect(scores).toEqual([
      inactiveScore,
      {
        criterionId: criterion.id,
        criterionName: criterion.name,
        points: 3,
        maxPoints: criterion.maxPoints,
      },
    ]);
  });

  it('clamps scores below zero and above max points', () => {
    expect(upsertCriterionScore([], criterion, -2)[0].points).toBe(0);
    expect(upsertCriterionScore([], criterion, 12)[0].points).toBe(5);
  });
});

describe('focused compare helpers', () => {
  it('cycles to the next answer index', () => {
    expect(nextAnswerIndex(0, 3)).toBe(1);
    expect(nextAnswerIndex(2, 3)).toBe(0);
    expect(nextAnswerIndex(0, 0)).toBe(0);
  });

  it('cycles to the previous answer index', () => {
    expect(previousAnswerIndex(2, 3)).toBe(1);
    expect(previousAnswerIndex(0, 3)).toBe(2);
    expect(previousAnswerIndex(0, 0)).toBe(0);
  });

  it('filters score summaries to active criteria', () => {
    const activeCriterion: RubricCriterion = {
      id: 'criterion-active',
      name: 'Active criterion',
      maxPoints: 5,
      weight: 1,
    };
    const activeScore: Score = {
      criterionId: activeCriterion.id,
      criterionName: activeCriterion.name,
      points: 4,
      maxPoints: activeCriterion.maxPoints,
    };
    const inactiveScore: Score = {
      criterionId: 'criterion-inactive',
      criterionName: 'Inactive criterion',
      points: 10,
      maxPoints: 10,
    };

    expect(activeScoresForCriteria([activeScore, inactiveScore], [activeCriterion])).toEqual([
      activeScore,
    ]);
  });
});
