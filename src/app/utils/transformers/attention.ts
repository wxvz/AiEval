/** Teaching toy: fixed 4-token attention → context → next-token ranking. Not a real transformer. */

export const TOKEN_COUNT = 4;

export interface SentenceToken {
  id: string;
  text: string;
  /** Tiny fixed "meaning" vector used as the value in the weighted sum. */
  value: readonly number[];
}

export interface NextTokenCandidate {
  id: string;
  text: string;
  vector: readonly number[];
}

export interface NextTokenScore {
  id: string;
  text: string;
  score: number;
}

export interface AttentionResult {
  weights: number[];
  context: number[];
  rankings: NextTokenScore[];
  success: boolean;
}

/** Fixed teaching sentence. */
export const SENTENCE_TOKENS: readonly SentenceToken[] = [
  { id: 'the', text: 'the', value: [0.1, 0.0, 0.0] },
  { id: 'cat', text: 'cat', value: [1.0, 0.0, 0.2] },
  { id: 'sat', text: 'sat', value: [0.0, 1.0, 0.1] },
  { id: 'down', text: 'down', value: [0.0, 0.3, 1.0] },
] as const;

/** Candidate continuations scored by dot product with the context vector. */
export const NEXT_TOKEN_CANDIDATES: readonly NextTokenCandidate[] = [
  { id: 'quietly', text: 'quietly', vector: [0.0, 1.2, 0.0] },
  { id: 'meowed', text: 'meowed', vector: [1.2, 0.0, 0.0] },
  { id: 'hard', text: 'hard', vector: [0.0, 0.0, 1.2] },
] as const;

/** Goal: make this candidate rank first (raise attention on "sat"). */
export const TARGET_WINNER_ID = 'quietly';

/** Target ranking when attention focuses on "sat". */
export const TARGET_RANKING_IDS: readonly string[] = ['quietly', 'hard', 'meowed'] as const;

/** Even starting weights (sum already 1). */
export const DEFAULT_ATTENTION_WEIGHTS: readonly number[] = [0.25, 0.25, 0.25, 0.25] as const;

/** Suggested focus that solves the challenge. */
export const HINT_ATTENTION_WEIGHTS: readonly number[] = [0.05, 0.1, 0.75, 0.1] as const;

const WEIGHT_SUM_EPSILON = 1e-6;

export function clampNonNegative(weights: readonly number[]): number[] {
  return weights.map((w) => Math.max(0, Number.isFinite(w) ? w : 0));
}

/** True when weights already sum to ~1 (no normalize needed). */
export function isNormalized(weights: readonly number[]): boolean {
  if (weights.length !== TOKEN_COUNT) {
    return false;
  }
  const clamped = clampNonNegative(weights);
  const sum = clamped.reduce((acc, w) => acc + w, 0);
  return Math.abs(sum - 1) <= WEIGHT_SUM_EPSILON;
}

/** Normalize non-negative weights to sum 1. All-zero → uniform. */
export function normalizeAttention(weights: readonly number[]): number[] {
  if (weights.length !== TOKEN_COUNT) {
    throw new Error(`Expected ${TOKEN_COUNT} attention weights, got ${weights.length}`);
  }
  const clamped = clampNonNegative(weights);
  const sum = clamped.reduce((acc, w) => acc + w, 0);
  if (sum <= WEIGHT_SUM_EPSILON) {
    return Array.from({ length: TOKEN_COUNT }, () => 1 / TOKEN_COUNT);
  }
  return clamped.map((w) => w / sum);
}

export function dotProduct(a: readonly number[], b: readonly number[]): number {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return sum;
}

/** Attention-weighted sum of token value vectors. */
export function computeContextVector(normalizedWeights: readonly number[]): number[] {
  if (normalizedWeights.length !== TOKEN_COUNT) {
    throw new Error(`Expected ${TOKEN_COUNT} normalized weights, got ${normalizedWeights.length}`);
  }
  const dims = SENTENCE_TOKENS[0]!.value.length;
  const context = Array.from({ length: dims }, () => 0);
  for (let i = 0; i < TOKEN_COUNT; i++) {
    const w = normalizedWeights[i]!;
    const value = SENTENCE_TOKENS[i]!.value;
    for (let d = 0; d < dims; d++) {
      context[d]! += w * value[d]!;
    }
  }
  return context;
}

/** Score and rank next-token candidates (highest score first; ties by text). */
export function rankNextTokens(context: readonly number[]): NextTokenScore[] {
  return NEXT_TOKEN_CANDIDATES.map((candidate) => ({
    id: candidate.id,
    text: candidate.text,
    score: dotProduct(context, candidate.vector),
  })).sort((a, b) => b.score - a.score || a.text.localeCompare(b.text));
}

/** True when the ranked list matches the teaching target order. */
export function matchesTargetRanking(rankings: readonly NextTokenScore[]): boolean {
  if (rankings.length < TARGET_RANKING_IDS.length) {
    return false;
  }
  return TARGET_RANKING_IDS.every((id, index) => rankings[index]?.id === id);
}

/** Full pipeline: normalize → context → rankings → success. */
export function evaluateAttention(rawWeights: readonly number[]): AttentionResult {
  const weights = normalizeAttention(rawWeights);
  const context = computeContextVector(weights);
  const rankings = rankNextTokens(context);
  return {
    weights,
    context,
    rankings,
    success: matchesTargetRanking(rankings),
  };
}
