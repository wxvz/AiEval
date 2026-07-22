import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ATTENTION_WEIGHTS,
  HINT_ATTENTION_WEIGHTS,
  SENTENCE_TOKENS,
  TARGET_RANKING_IDS,
  TARGET_WINNER_ID,
  TOKEN_COUNT,
  computeContextVector,
  evaluateAttention,
  isNormalized,
  matchesTargetRanking,
  normalizeAttention,
  rankNextTokens,
} from './attention';

describe('transformers attention teaching engine', () => {
  it('exposes a fixed 4-token sentence', () => {
    expect(SENTENCE_TOKENS).toHaveLength(TOKEN_COUNT);
    expect(SENTENCE_TOKENS.map((t) => t.text).join(' ')).toBe('the cat sat down');
  });

  it('normalizes non-negative weights to sum 1', () => {
    const weights = normalizeAttention([1, 1, 2, 0]);
    expect(weights.reduce((sum, w) => sum + w, 0)).toBeCloseTo(1, 6);
    expect(weights[2]).toBeCloseTo(0.5, 6);
  });

  it('clamps negatives and treats all-zero as uniform', () => {
    expect(normalizeAttention([-1, 0, 0, 0])).toEqual([0.25, 0.25, 0.25, 0.25]);
    expect(normalizeAttention([0, 0, 0, 0])).toEqual([0.25, 0.25, 0.25, 0.25]);
  });

  it('detects whether weights already sum to 1', () => {
    expect(isNormalized([...DEFAULT_ATTENTION_WEIGHTS])).toBe(true);
    expect(isNormalized([1, 1, 1, 1])).toBe(false);
  });

  it('computes an attention-weighted context vector', () => {
    const satOnly = normalizeAttention([0, 0, 1, 0]);
    const context = computeContextVector(satOnly);
    expect(context).toEqual([...SENTENCE_TOKENS[2]!.value]);
  });

  it('ranks quietly first when attention focuses on sat', () => {
    const result = evaluateAttention([0, 0, 1, 0]);
    expect(result.rankings[0]?.id).toBe(TARGET_WINNER_ID);
    expect(result.rankings.map((r) => r.id)).toEqual([...TARGET_RANKING_IDS]);
    expect(result.success).toBe(true);
  });

  it('does not mark default even weights as success', () => {
    const result = evaluateAttention([...DEFAULT_ATTENTION_WEIGHTS]);
    expect(result.success).toBe(false);
    expect(matchesTargetRanking(result.rankings)).toBe(false);
  });

  it('makes meowed win when attention focuses on cat', () => {
    const rankings = rankNextTokens(computeContextVector(normalizeAttention([0, 1, 0, 0])));
    expect(rankings[0]?.id).toBe('meowed');
  });

  it('makes hard win when attention focuses on down', () => {
    const rankings = rankNextTokens(computeContextVector(normalizeAttention([0, 0, 0, 1])));
    expect(rankings[0]?.id).toBe('hard');
  });

  it('solves the challenge with the hint weights', () => {
    expect(evaluateAttention([...HINT_ATTENTION_WEIGHTS]).success).toBe(true);
  });
});
