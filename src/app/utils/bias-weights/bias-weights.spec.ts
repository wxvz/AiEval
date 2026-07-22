import { describe, expect, it } from 'vitest';

import {
  BIAS_WEIGHTS_X_VALUES,
  TARGET_BIAS,
  TARGET_WEIGHT,
  evaluateRows,
  isBoundarySolved,
  isSolved,
  matchesTargetParams,
  neuronScore,
  predict,
  rowMatchesTarget,
  wantPositive,
} from './bias-weights';

describe('bias-weights engine', () => {
  it('exposes five fixed x values from 0 to 1', () => {
    expect([...BIAS_WEIGHTS_X_VALUES]).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it('computes score as w * x + b', () => {
    expect(neuronScore(0.5, 4, -1.5)).toBeCloseTo(0.5, 8);
    expect(neuronScore(0, 2, 1)).toBe(1);
  });

  it('applies sigmoid to the score', () => {
    expect(predict(0, 0, 0)).toBeCloseTo(0.5, 8);
    expect(predict(1, 10, 0)).toBeGreaterThan(0.99);
    expect(predict(0, 10, -20)).toBeLessThan(0.01);
  });

  it('defines wantPositive for x >= 0.5', () => {
    expect(wantPositive(0)).toBe(false);
    expect(wantPositive(0.25)).toBe(false);
    expect(wantPositive(0.5)).toBe(true);
    expect(wantPositive(1)).toBe(true);
  });

  it('treats prediction of exactly 0.5 as incorrect for the positive class', () => {
    expect(rowMatchesTarget(0.5, 0.5)).toBe(false);
    expect(rowMatchesTarget(0.5, 0.25)).toBe(true);
  });

  it('marks target (w*, b*) as boundary-solved', () => {
    expect(isBoundarySolved(TARGET_WEIGHT, TARGET_BIAS)).toBe(true);
    const rows = evaluateRows(TARGET_WEIGHT, TARGET_BIAS);
    expect(rows.every((row) => row.correct)).toBe(true);
    expect(rows.find((row) => row.x === 0.25)?.prediction).toBeLessThanOrEqual(0.5);
    expect(rows.find((row) => row.x === 0.5)?.prediction).toBeGreaterThan(0.5);
  });

  it('does not solve with zero weight and bias', () => {
    expect(isBoundarySolved(0, 0)).toBe(false);
    expect(isSolved(0, 0)).toBe(false);
  });

  it('matches target params within tolerance', () => {
    expect(matchesTargetParams(TARGET_WEIGHT, TARGET_BIAS)).toBe(true);
    expect(matchesTargetParams(4.2, -1.4)).toBe(true);
    expect(matchesTargetParams(0, 0)).toBe(false);
  });

  it('isSolved when either boundary or params succeed', () => {
    // Different params that still place the zero-crossing in (0.25, 0.5)
    expect(isBoundarySolved(8, -3)).toBe(true);
    expect(isSolved(8, -3)).toBe(true);
    expect(matchesTargetParams(8, -3)).toBe(false);
  });
});
