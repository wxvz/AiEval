import { describe, expect, it } from 'vitest';

import {
  ACTIVATION_PROBE_Z,
  TARGET_ACTIVATION,
  activate,
  activationLabel,
  evaluateProbes,
  isSolved,
  sampleCurve,
} from './activation-functions';

describe('activation-functions engine', () => {
  it('exposes five probe scores from -2 to 2', () => {
    expect([...ACTIVATION_PROBE_Z]).toEqual([-2, -1, 0, 1, 2]);
  });

  it('applies linear, sigmoid, relu, and tanh', () => {
    expect(activate('linear', -1.5)).toBe(-1.5);
    expect(activate('relu', -1)).toBe(0);
    expect(activate('relu', 1.5)).toBe(1.5);
    expect(activate('sigmoid', 0)).toBeCloseTo(0.5, 8);
    expect(activate('tanh', 0)).toBeCloseTo(0, 8);
  });

  it('evaluates every probe for a named activation', () => {
    const rows = evaluateProbes('relu');
    expect(rows).toHaveLength(5);
    expect(rows.find((row) => row.z === -2)?.output).toBe(0);
    expect(rows.find((row) => row.z === 2)?.output).toBe(2);
  });

  it('samples a curve with inclusive endpoints', () => {
    const points = sampleCurve('linear', -1, 1, 3);
    expect(points).toEqual([
      { z: -1, y: -1 },
      { z: 0, y: 0 },
      { z: 1, y: 1 },
    ]);
  });

  it('marks ReLU as the solved target', () => {
    expect(TARGET_ACTIVATION).toBe('relu');
    expect(isSolved('relu')).toBe(true);
    expect(isSolved('sigmoid')).toBe(false);
  });

  it('returns display labels', () => {
    expect(activationLabel('relu')).toBe('ReLU');
    expect(activationLabel('sigmoid')).toBe('Sigmoid');
  });
});
