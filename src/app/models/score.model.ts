export interface ScorableCriterion {
  id: string;
  name: string;
  maxPoints: number;
}

export interface Score {
  criterionId: string;
  criterionName: string;
  points: number;
  maxPoints: number;
  notes?: string;
}

export function initialScoresForCriteria(criteria: ScorableCriterion[]): Score[] {
  return criteria.map((criterion) => ({
    criterionId: criterion.id,
    criterionName: criterion.name,
    points: 0,
    maxPoints: criterion.maxPoints,
  }));
}

export interface ScoreSummary {
  totalPoints: number;
  maxPoints: number;
  percentage: number;
}

export function computeScoreSummary(scores: Score[]): ScoreSummary {
  const totalPoints = scores.reduce((sum, score) => sum + score.points, 0);
  const maxPoints = scores.reduce((sum, score) => sum + score.maxPoints, 0);
  const percentage = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;

  return { totalPoints, maxPoints, percentage };
}
