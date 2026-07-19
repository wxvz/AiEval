/**
 * One-neuron toy for the Bias and weights lab.
 * Pure TypeScript — no Angular imports.
 */

import { ELEMENTWISE_ACTIVATIONS } from '../nn/activations';

const sigmoid = ELEMENTWISE_ACTIVATIONS.sigmoid.forward;

/** Fixed probe inputs along [0, 1]. */
export const BIAS_WEIGHTS_X_VALUES = [0, 0.25, 0.5, 0.75, 1] as const;

/**
 * Example parameters that solve the lab target boundary
 * (positive class for x >= 0.5). Zero-crossing at x = 0.375.
 */
export const TARGET_WEIGHT = 4;
export const TARGET_BIAS = -1.5;

/** Absolute tolerance when matching a target (w*, b*) pair. */
export const PARAM_TOLERANCE = 0.25;

export interface BiasWeightsParams {
  weight: number;
  bias: number;
}

export interface BiasWeightsRow {
  x: number;
  score: number;
  prediction: number;
  /** Desired decision: true when prediction should be > 0.5. */
  wantPositive: boolean;
  /** Whether the prediction matches the target decision. */
  correct: boolean;
}

/** Linear score before activation: w * x + b. */
export function neuronScore(x: number, weight: number, bias: number): number {
  return weight * x + bias;
}

/** Sigmoid(w * x + b). */
export function predict(x: number, weight: number, bias: number): number {
  return sigmoid(neuronScore(x, weight, bias));
}

/**
 * Target decision for this lab: high output when x >= 0.5, low otherwise.
 * Uses strict > 0.5 for the positive class (sigmoid(0) = 0.5 fails).
 */
export function wantPositive(x: number): boolean {
  return x >= 0.5;
}

export function rowMatchesTarget(prediction: number, x: number): boolean {
  const positive = prediction > 0.5;
  return positive === wantPositive(x);
}

/** Evaluate the toy neuron on every fixed x. */
export function evaluateRows(weight: number, bias: number): BiasWeightsRow[] {
  return BIAS_WEIGHTS_X_VALUES.map((x) => {
    const score = neuronScore(x, weight, bias);
    const prediction = sigmoid(score);
    return {
      x,
      score,
      prediction,
      wantPositive: wantPositive(x),
      correct: rowMatchesTarget(prediction, x),
    };
  });
}

/** True when every probe x matches the target decision boundary. */
export function isBoundarySolved(weight: number, bias: number): boolean {
  return evaluateRows(weight, bias).every((row) => row.correct);
}

/** True when (weight, bias) are within tolerance of a target pair. */
export function matchesTargetParams(
  weight: number,
  bias: number,
  targetWeight: number = TARGET_WEIGHT,
  targetBias: number = TARGET_BIAS,
  tolerance: number = PARAM_TOLERANCE,
): boolean {
  return (
    Math.abs(weight - targetWeight) <= tolerance && Math.abs(bias - targetBias) <= tolerance
  );
}

/**
 * Lab success: either the decision boundary is correct on all x,
 * or parameters match the example target within tolerance.
 */
export function isSolved(weight: number, bias: number): boolean {
  return isBoundarySolved(weight, bias) || matchesTargetParams(weight, bias);
}
