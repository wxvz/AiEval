/**
 * Teaching helpers for the Activation functions lab.
 * Pure TypeScript — reuses nn elementwise activations.
 */

import { ELEMENTWISE_ACTIVATIONS, type ElementwiseActivationName } from '../nn/activations';

export type LabActivationName = ElementwiseActivationName;

export const LAB_ACTIVATIONS: readonly LabActivationName[] = [
  'linear',
  'sigmoid',
  'relu',
  'tanh',
] as const;

/** Fixed probe scores spanning negative, zero, and positive. */
export const ACTIVATION_PROBE_Z = [-2, -1, 0, 1, 2] as const;

/** Target shape for the lab challenge: ReLU. */
export const TARGET_ACTIVATION: LabActivationName = 'relu';

export interface ActivationProbeRow {
  z: number;
  output: number;
}

export interface CurvePoint {
  z: number;
  y: number;
}

/** Apply a named elementwise activation to a score. */
export function activate(name: LabActivationName, z: number): number {
  return ELEMENTWISE_ACTIVATIONS[name].forward(z);
}

/** Evaluate an activation on every fixed probe score. */
export function evaluateProbes(name: LabActivationName): ActivationProbeRow[] {
  return ACTIVATION_PROBE_Z.map((z) => ({
    z,
    output: activate(name, z),
  }));
}

/**
 * Sample an activation curve for SVG plotting.
 * z runs from zMin to zMax inclusive.
 */
export function sampleCurve(
  name: LabActivationName,
  zMin = -3,
  zMax = 3,
  steps = 49,
): CurvePoint[] {
  if (steps < 2) {
    return [{ z: zMin, y: activate(name, zMin) }];
  }
  const points: CurvePoint[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const z = zMin + t * (zMax - zMin);
    points.push({ z, y: activate(name, z) });
  }
  return points;
}

/** True when the learner selected the target activation (ReLU). */
export function isSolved(selected: LabActivationName): boolean {
  return selected === TARGET_ACTIVATION;
}

/** Short teaching label for UI buttons. */
export function activationLabel(name: LabActivationName): string {
  switch (name) {
    case 'linear':
      return 'Linear';
    case 'sigmoid':
      return 'Sigmoid';
    case 'relu':
      return 'ReLU';
    case 'tanh':
      return 'Tanh';
  }
}
