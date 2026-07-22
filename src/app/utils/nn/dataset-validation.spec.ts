import { describe, it, expect } from 'vitest';
import {
  parseField,
  parseClassField,
  classToOneHot,
  argmax,
  isFiniteRow,
  datasetValidationMessage,
  softmaxCustomValidationMessage,
  customDatasetValidationMessage,
  toTrainSample,
  targetsOutsideUnitInterval,
  sigmoidTargetWarning,
  usesRegressionDisplay,
  type CustomRow,
} from './dataset-validation';

describe('parseField', () => {
  it('binary snaps values to 0 or 1', () => {
    expect(parseField(0.2, 'binary')).toBe(0);
    expect(parseField(0.5, 'binary')).toBe(1);
    expect(parseField(0.9, 'binary')).toBe(1);
    expect(parseField('0.49', 'binary')).toBe(0);
    expect(parseField('1', 'binary')).toBe(1);
  });

  it('free accepts arbitrary finite floats', () => {
    expect(parseField(2, 'free')).toBe(2);
    expect(parseField(-1, 'free')).toBe(-1);
    expect(parseField(0.37, 'free')).toBe(0.37);
    expect(parseField('0.37', 'free')).toBeCloseTo(0.37);
  });
});

describe('isFiniteRow', () => {
  it('accepts finite x1, x2, and y', () => {
    expect(isFiniteRow({ x1: 1, x2: 0, y: 0.5 })).toBe(true);
  });

  it('rejects non-finite values', () => {
    expect(isFiniteRow({ x1: Number.NaN, x2: 0, y: 1 })).toBe(false);
    expect(isFiniteRow({ x1: 1, x2: Infinity, y: 0 })).toBe(false);
    expect(isFiniteRow({ x1: 0, x2: 0, y: Number.NaN })).toBe(false);
  });
});

describe('datasetValidationMessage', () => {
  it('requires at least one row', () => {
    expect(datasetValidationMessage([])).toBe('Add at least one training row.');
  });

  it('rejects rows with non-finite numbers', () => {
    const rows: CustomRow[] = [
      { x1: 1, x2: 0, y: 1 },
      { x1: Number.NaN, x2: 0, y: 0 },
    ];
    expect(datasetValidationMessage(rows)).toBe(
      'Every row needs finite numbers for x1, x2, and y.',
    );
  });

  it('returns null for valid rows', () => {
    expect(datasetValidationMessage([{ x1: 1, x2: 0, y: 2 }])).toBeNull();
  });
});

describe('targetsOutsideUnitInterval', () => {
  it('is false when all targets are in [0, 1]', () => {
    expect(targetsOutsideUnitInterval([{ x1: 0, x2: 0, y: 0 }, { x1: 1, x2: 1, y: 1 }])).toBe(
      false,
    );
    expect(targetsOutsideUnitInterval([{ x1: 0, x2: 0, y: 0.5 }])).toBe(false);
  });

  it('is true when any target is outside [0, 1]', () => {
    expect(targetsOutsideUnitInterval([{ x1: 1, x2: 0, y: 2 }])).toBe(true);
    expect(targetsOutsideUnitInterval([{ x1: 0, x2: 0, y: -0.1 }])).toBe(true);
    expect(targetsOutsideUnitInterval([{ x1: 0, x2: 0, y: 1.01 }])).toBe(true);
  });
});

describe('softmax validation', () => {
  it('classToOneHot encodes class index', () => {
    expect(classToOneHot(1)).toEqual([0, 1, 0]);
  });

  it('toTrainSample expands class to one-hot for softmax', () => {
    expect(toTrainSample({ x1: 1, x2: 0, y: 2 }, 'softmax')).toEqual({
      input: [1, 0],
      target: [0, 0, 1],
    });
  });

  it('softmaxCustomValidationMessage rejects invalid class', () => {
    expect(softmaxCustomValidationMessage([{ x1: 0, x2: 0, y: 3 }])).toMatch(/0, 1, or 2/);
    expect(softmaxCustomValidationMessage([{ x1: 0, x2: 0, y: 1 }])).toBeNull();
  });

  it('customDatasetValidationMessage uses softmax rules', () => {
    expect(customDatasetValidationMessage([{ x1: 0, x2: 0, y: 5 }], 'softmax')).toMatch(
      /0, 1, or 2/,
    );
    expect(customDatasetValidationMessage([{ x1: 0, x2: 0, y: 2 }], 'linear')).toBeNull();
  });
});

describe('argmax', () => {
  it('returns index of largest value', () => {
    expect(argmax([0.1, 0.8, 0.1])).toBe(1);
  });
});

describe('parseClassField', () => {
  it('binary snaps to valid class 0..2', () => {
    expect(parseClassField(2, 'binary')).toBe(2);
    expect(parseClassField(0.6, 'binary')).toBe(1);
  });
});

describe('sigmoidTargetWarning', () => {
  it('warns when sigmoid output and targets are outside (0, 1)', () => {
    expect(sigmoidTargetWarning([{ x1: 1, x2: 0, y: 2 }])).toMatch(/Linear output/);
  });

  it('returns null for in-range targets or non-sigmoid output', () => {
    expect(sigmoidTargetWarning([{ x1: 0, x2: 1, y: 0.5 }])).toBeNull();
    expect(sigmoidTargetWarning([{ x1: 1, x2: 0, y: 2 }], 'linear')).toBeNull();
  });
});

describe('usesRegressionDisplay', () => {
  it('is false when all targets are exactly 0 or 1', () => {
    expect(usesRegressionDisplay([0, 1, 0, 1])).toBe(false);
  });

  it('is true when any target is not binary', () => {
    expect(usesRegressionDisplay([0, 1, 2])).toBe(true);
    expect(usesRegressionDisplay([0.5])).toBe(true);
    expect(usesRegressionDisplay([-1])).toBe(true);
  });
});
