import type { RubricCriterion, Score } from '../types/evaluation.js';

export function initialScoresForCriteria(criteria: RubricCriterion[]): Score[] {
  return criteria.map((criterion) => ({
    criterionId: criterion.id,
    criterionName: criterion.name,
    points: 0,
    maxPoints: criterion.maxPoints,
  }));
}

export function clampScore(points: number, maxPoints: number): number {
  if (!Number.isFinite(points)) {
    return 0;
  }

  return Math.min(Math.max(points, 0), maxPoints);
}

export function computeTotalPoints(scores: Score[]): number {
  return scores.reduce((sum, score) => sum + score.points, 0);
}

export function computeMaxPoints(scores: Score[]): number {
  return scores.reduce((sum, score) => sum + score.maxPoints, 0);
}

export interface WinnerResult {
  answerId: string;
  label: string;
  totalPoints: number;
}

export function pickWinner(
  answers: { id: string; label: string; scores: Score[] }[],
): WinnerResult | null {
  if (answers.length === 0) {
    return null;
  }

  let best = answers[0];
  let bestTotal = computeTotalPoints(best.scores);
  let bestMax = computeMaxPoints(best.scores);
  let bestPct = bestMax > 0 ? bestTotal / bestMax : 0;

  for (let index = 1; index < answers.length; index += 1) {
    const candidate = answers[index];
    const total = computeTotalPoints(candidate.scores);
    const max = computeMaxPoints(candidate.scores);
    const pct = max > 0 ? total / max : 0;

    if (total > bestTotal) {
      best = candidate;
      bestTotal = total;
      bestMax = max;
      bestPct = pct;
      continue;
    }

    if (total === bestTotal && pct > bestPct) {
      best = candidate;
      bestTotal = total;
      bestMax = max;
      bestPct = pct;
    }
  }

  return {
    answerId: best.id,
    label: best.label,
    totalPoints: bestTotal,
  };
}
