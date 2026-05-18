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

/** Parse judge point values that may be absolute, fractional, or percentage-scaled. */
export function parseJudgePointsValue(value: unknown, maxPoints: number): number {
  if (typeof value === 'number') {
    return normalizeJudgePoints(value, maxPoints);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const percentMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*%$/);

    if (percentMatch) {
      return normalizeJudgePoints(Number(percentMatch[1]), maxPoints);
    }

    const parsed = Number(trimmed);

    if (Number.isFinite(parsed)) {
      return normalizeJudgePoints(parsed, maxPoints);
    }
  }

  return 0;
}

/**
 * Judges sometimes return 0–100 percentages instead of 0..maxPoints.
 * Values above maxPoints but ≤100 are treated as percent of maxPoints.
 */
export function normalizeJudgePoints(points: number, maxPoints: number): number {
  if (!Number.isFinite(points) || maxPoints <= 0) {
    return 0;
  }

  if (points > maxPoints) {
    if (points <= 100) {
      return clampScore(Math.round((points / 100) * maxPoints), maxPoints);
    }

    return clampScore(points, maxPoints);
  }

  if (points > 0 && points < 1) {
    return clampScore(Math.round(points * maxPoints), maxPoints);
  }

  return clampScore(points, maxPoints);
}

export function computeTotalPoints(scores: Score[]): number {
  return scores.reduce((sum, score) => sum + score.points, 0);
}

export function computeMaxPoints(scores: Score[]): number {
  return scores.reduce((sum, score) => sum + score.maxPoints, 0);
}

export function allAnswersHaveEqualTotals(answers: { scores: Score[] }[]): boolean {
  if (answers.length < 2) {
    return false;
  }

  const [firstTotal, ...restTotals] = answers.map((answer) => computeTotalPoints(answer.scores));

  return restTotals.every((total) => total === firstTotal);
}

export function scaleAnswerScores<T extends { scores: Score[] }>(answer: T, factor: number): T {
  if (factor === 1) {
    return answer;
  }

  return {
    ...answer,
    scores: answer.scores.map((score) => ({
      ...score,
      points: clampScore(Math.round(score.points * factor), score.maxPoints),
    })),
  };
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
