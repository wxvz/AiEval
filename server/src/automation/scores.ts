import { BUILT_IN_ANCHOR_POINTS, getDiscreteAnchorPoints } from './rubric-anchors.js';
import { jsonToSentences } from '../format/json-to-sentences.js';
import type { Answer, RubricCriterion, Score } from '../types/evaluation.js';

interface JudgeScoreEntry {
  criterionId: string;
  points: unknown;
  notes?: unknown;
  confidence?: unknown;
}

export interface ParsedJudgeScoreResponse {
  scores: Score[];
  answerNotes?: string;
}

function readJudgeNotes(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const text = jsonToSentences(value);
  return text || undefined;
}

export function parseJudgeScoreResponse(
  raw: unknown,
  criteria: RubricCriterion[],
  existingScores: Score[],
): ParsedJudgeScoreResponse {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid scores JSON');
  }

  const record = raw as Record<string, unknown>;
  const answerNotes =
    readJudgeNotes(record.answerNotes) ??
    readJudgeNotes(record.notes);

  if (!('scores' in record)) {
    throw new Error('Invalid scores JSON');
  }

  const entries = record.scores;

  if (!Array.isArray(entries)) {
    throw new Error('Invalid scores array');
  }

  const scores = criteria.map((criterion) => {
    const existingScore = existingScores.find((score) => score.criterionId === criterion.id);
    const match = entries.find(
      (entry): entry is JudgeScoreEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        (entry as JudgeScoreEntry).criterionId === criterion.id,
    );

    const anchorPoints = getDiscreteAnchorPoints(criterion, criteria);
    const points = parseJudgePointsValue(match?.points, criterion.maxPoints, anchorPoints);
    const notes = readJudgeNotes(match?.notes) ?? existingScore?.notes;
    const confidence = parseConfidence(match?.confidence) ?? existingScore?.confidence;

    return {
      criterionId: criterion.id,
      criterionName: criterion.name,
      points,
      maxPoints: criterion.maxPoints,
      ...(notes ? { notes } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
    };
  });

  return {
    scores,
    ...(answerNotes ? { answerNotes } : {}),
  };
}

export interface ParsedBatchJudgeScoreRow extends ParsedJudgeScoreResponse {
  answerId: string;
}

function readAnswerId(entry: Record<string, unknown>): string | undefined {
  const id = entry.answerId;

  if (typeof id === 'string' && id.trim()) {
    return id.trim();
  }

  return undefined;
}

function readAnswerIndex(entry: Record<string, unknown>): number | undefined {
  const idx = entry.answerIndex;

  if (typeof idx === 'number' && Number.isFinite(idx)) {
    return Math.trunc(idx);
  }

  if (typeof idx === 'string') {
    const parsed = Number(idx.trim());

    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return undefined;
}

/** Merge judge batch JSON into input answer order; throws if any answer is missing or duplicated. */
export function parseJudgeBatchScoreResponse(
  raw: unknown,
  criteria: RubricCriterion[],
  answers: Answer[],
): ParsedBatchJudgeScoreRow[] {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid batch scores JSON');
  }

  const record = raw as Record<string, unknown>;
  const list = record.answers;

  if (!Array.isArray(list)) {
    throw new Error('Invalid batch scores answers array');
  }

  const consumed = new Set<number>();
  const merged = new Map<string, ParsedJudgeScoreResponse>();

  for (const item of list) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const row = item as Record<string, unknown>;
    let answerId = readAnswerId(row);
    const answerIndex = readAnswerIndex(row);

    if (!answerId && answerIndex !== undefined) {
      const zeroBased = answerIndex - 1;

      if (zeroBased >= 0 && zeroBased < answers.length) {
        answerId = answers[zeroBased]!.id;
      }
    }

    if (!answerId) {
      continue;
    }

    const indexInRun = answers.findIndex((a) => a.id === answerId);

    if (indexInRun < 0) {
      throw new Error(`Unknown answerId in batch judge JSON: ${answerId}`);
    }

    if (consumed.has(indexInRun)) {
      throw new Error(`Duplicate judge scores for answer ${answerId}`);
    }

    consumed.add(indexInRun);

    const existingScores = answers[indexInRun]!.scores;
    const parsed = parseJudgeScoreResponse(row, criteria, existingScores);
    merged.set(answerId, parsed);
  }

  return answers.map((answer, index) => {
    const parsed = merged.get(answer.id);

    if (!parsed) {
      throw new Error(`Missing judge scores for answer index ${index + 1} (${answer.id})`);
    }

    return {
      answerId: answer.id,
      scores: parsed.scores,
      ...(parsed.answerNotes ? { answerNotes: parsed.answerNotes } : {}),
    };
  });
}

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

/** Snap judge output to discrete anchors, or clamp when no anchors apply. */
export function snapToAnchorPoints(
  points: number,
  maxPoints: number,
  anchorPoints: readonly number[] = [],
): number {
  const discreteAnchors = anchorPoints.filter((anchor) => Number.isFinite(anchor));

  if (discreteAnchors.length > 0) {
    const clamped = clampScore(points, maxPoints);
    const floor = Math.min(...discreteAnchors);
    const normalized = clamped <= 0 ? floor : clamped;

    let best = discreteAnchors[0]!;
    let bestDistance = Math.abs(normalized - best);

    for (const anchor of discreteAnchors) {
      const distance = Math.abs(normalized - anchor);

      if (distance < bestDistance || (distance === bestDistance && anchor < best)) {
        best = anchor;
        bestDistance = distance;
      }
    }

    return best;
  }

  return clampScore(points, maxPoints);
}

/** Snap to built-in 1–5 anchors when maxPoints is 5. */
export function snapToBuiltInAnchors(points: number, maxPoints: number): number {
  if (maxPoints !== 5) {
    return clampScore(points, maxPoints);
  }

  return snapToAnchorPoints(points, maxPoints, BUILT_IN_ANCHOR_POINTS);
}

/** Parse judge point values that may be absolute, fractional, or percentage-scaled. */
export function parseJudgePointsValue(
  value: unknown,
  maxPoints: number,
  anchorPoints: readonly number[] = [],
): number {
  if (typeof value === 'number') {
    return normalizeJudgePoints(value, maxPoints, anchorPoints);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const percentMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*%$/);

    if (percentMatch) {
      return normalizeJudgePoints(Number(percentMatch[1]), maxPoints, anchorPoints);
    }

    const parsed = Number(trimmed);

    if (Number.isFinite(parsed)) {
      return normalizeJudgePoints(parsed, maxPoints, anchorPoints);
    }
  }

  return 0;
}

/**
 * Judges sometimes return 0–100 percentages instead of 0..maxPoints.
 * Values above maxPoints but ≤100 are treated as percent of maxPoints.
 */
export function normalizeJudgePoints(
  points: number,
  maxPoints: number,
  anchorPoints: readonly number[] = [],
): number {
  if (!Number.isFinite(points) || maxPoints <= 0) {
    return 0;
  }

  let normalized: number;

  if (points > maxPoints) {
    if (points <= 100) {
      normalized = clampScore(Math.round((points / 100) * maxPoints), maxPoints);
    } else {
      normalized = clampScore(points, maxPoints);
    }
  } else if (points > 0 && points < 1) {
    normalized = clampScore(Math.round(points * maxPoints), maxPoints);
  } else {
    normalized = clampScore(points, maxPoints);
  }

  return snapToAnchorPoints(normalized, maxPoints, anchorPoints);
}

export function computeTotalPoints(scores: Score[]): number {
  return scores.reduce((sum, score) => sum + score.points, 0);
}

export function computeMaxPoints(scores: Score[]): number {
  return scores.reduce((sum, score) => sum + score.maxPoints, 0);
}

export function computeWeightedNormalizedScore(
  scores: Score[],
  criteria: RubricCriterion[],
): number {
  const scoreById = new Map(scores.map((score) => [score.criterionId, score]));

  return criteria.reduce((sum, criterion) => {
    const score = scoreById.get(criterion.id);
    const normalized = score && score.maxPoints > 0 ? score.points / score.maxPoints : 0;
    return sum + normalized * criterion.weight;
  }, 0);
}

export function allAnswersHaveEqualTotals(
  answers: { scores: Score[] }[],
  criteria?: RubricCriterion[],
): boolean {
  if (answers.length < 2) {
    return false;
  }

  const [firstTotal, ...restTotals] = answers.map((answer) =>
    criteria
      ? computeWeightedNormalizedScore(answer.scores, criteria)
      : computeTotalPoints(answer.scores),
  );

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
  criteria?: RubricCriterion[],
): WinnerResult | null {
  if (answers.length === 0) {
    return null;
  }

  let best = answers[0];
  let bestTotal = computeTotalPoints(best.scores);
  let bestWeighted = criteria
    ? computeWeightedNormalizedScore(best.scores, criteria)
    : bestTotal;
  let bestMax = computeMaxPoints(best.scores);
  let bestPct = bestMax > 0 ? bestTotal / bestMax : 0;

  for (let index = 1; index < answers.length; index += 1) {
    const candidate = answers[index];
    const total = computeTotalPoints(candidate.scores);
    const weighted = criteria ? computeWeightedNormalizedScore(candidate.scores, criteria) : total;
    const max = computeMaxPoints(candidate.scores);
    const pct = max > 0 ? total / max : 0;

    if (weighted > bestWeighted) {
      best = candidate;
      bestTotal = total;
      bestMax = max;
      bestPct = pct;
      bestWeighted = weighted;
      continue;
    }

    if (weighted === bestWeighted && pct > bestPct) {
      best = candidate;
      bestTotal = total;
      bestMax = max;
      bestPct = pct;
      bestWeighted = weighted;
    }
  }

  return {
    answerId: best.id,
    label: best.label,
    totalPoints: bestTotal,
  };
}

function parseConfidence(value: unknown): number | undefined {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numeric)) {
    return undefined;
  }

  const normalized = numeric > 1 && numeric <= 100 ? numeric / 100 : numeric;
  return Math.min(Math.max(normalized, 0), 1);
}
