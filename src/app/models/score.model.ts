export interface ScorableCriterion {
  id: string;
  name: string;
  maxPoints: number;
  weight?: number;
}

export interface Score {
  criterionId: string;
  criterionName: string;
  points: number;
  maxPoints: number;
  notes?: string;
  confidence?: number;
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

export function computeScoreSummary(
  scores: Score[],
  criteria?: ScorableCriterion[],
): ScoreSummary {
  const weightById = new Map(criteria?.map((criterion) => [criterion.id, criterion.weight ?? 1]));
  const weighted = !!criteria;
  const totalPoints = scores.reduce((sum, score) => {
    const weight = weightById.get(score.criterionId) ?? 1;
    return sum + (weighted && score.maxPoints > 0 ? (score.points / score.maxPoints) * weight : score.points);
  }, 0);
  const maxPoints = scores.reduce((sum, score) => {
    const weight = weightById.get(score.criterionId) ?? 1;
    return sum + (weighted ? weight : score.maxPoints);
  }, 0);
  const percentage = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;

  return { totalPoints, maxPoints, percentage };
}

export function upsertCriterionScore(
  scores: Score[],
  criterion: ScorableCriterion,
  points: number,
): Score[] {
  const clampedPoints = clampScoreValue(points, criterion.maxPoints);
  const nextScore: Score = {
    criterionId: criterion.id,
    criterionName: criterion.name,
    points: clampedPoints,
    maxPoints: criterion.maxPoints,
  };
  const existingScore = scores.find((score) => score.criterionId === criterion.id);

  if (!existingScore) {
    return [...scores, nextScore];
  }

  return scores.map((score) =>
    score.criterionId === criterion.id
      ? {
          ...score,
          ...nextScore,
          ...(score.notes ? { notes: score.notes } : {}),
          ...(score.confidence !== undefined ? { confidence: score.confidence } : {}),
        }
      : score,
  );
}

function clampScoreValue(points: number, maxPoints: number): number {
  if (!Number.isFinite(points)) {
    return 0;
  }

  return Math.min(Math.max(points, 0), maxPoints);
}
