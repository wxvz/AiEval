import { RubricCriterion, Score } from '../../models';
import { upsertCriterionScore } from './compare-answers-page';

describe('upsertCriterionScore', () => {
  const criterion: RubricCriterion = {
    id: 'criterion-accuracy',
    name: 'Accuracy',
    maxPoints: 5,
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
