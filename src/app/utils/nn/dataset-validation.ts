import { TrainSample } from './network';

export type EntryStyle = 'binary' | 'free';

export const SOFTMAX_CLASS_COUNT = 3;

export interface CustomRow {
  x1: number;
  x2: number;
  y: number;
}

/** Parse a field from the editor; binary snaps to 0 or 1, free accepts any finite float. */
export function parseField(value: string | number, style: EntryStyle): number {
  const num = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(num)) {
    return Number.NaN;
  }
  if (style === 'binary') {
    return num >= 0.5 ? 1 : 0;
  }
  return num;
}

/** Parse class label 0..numClasses-1 for softmax custom rows. */
export function parseClassField(
  value: string | number,
  style: EntryStyle,
  numClasses = SOFTMAX_CLASS_COUNT,
): number {
  const num = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(num)) {
    return Number.NaN;
  }
  if (style === 'binary') {
    const snapped = Math.round(num);
    return Math.min(numClasses - 1, Math.max(0, snapped));
  }
  return num;
}

export function classToOneHot(classIndex: number, numClasses = SOFTMAX_CLASS_COUNT): number[] {
  const oneHot = Array<number>(numClasses).fill(0);
  const idx = Math.round(classIndex);
  if (idx >= 0 && idx < numClasses) {
    oneHot[idx] = 1;
  }
  return oneHot;
}

export function argmax(values: number[]): number {
  return values.reduce((best, v, i, arr) => (v > arr[best] ? i : best), 0);
}

export function toTrainSample(row: CustomRow, outputActivation = 'sigmoid'): TrainSample {
  if (outputActivation === 'softmax') {
    return { input: [row.x1, row.x2], target: classToOneHot(row.y) };
  }
  return { input: [row.x1, row.x2], target: [row.y] };
}

export function toDataset(rows: CustomRow[], outputActivation = 'sigmoid'): TrainSample[] {
  return rows.map((row) => toTrainSample(row, outputActivation));
}

export function isFiniteRow(row: CustomRow): boolean {
  return Number.isFinite(row.x1) && Number.isFinite(row.x2) && Number.isFinite(row.y);
}

export function isValidSoftmaxClass(y: number, numClasses = SOFTMAX_CLASS_COUNT): boolean {
  if (!Number.isFinite(y)) {
    return false;
  }
  const c = Math.round(y);
  return c >= 0 && c < numClasses && Math.abs(y - c) < 1e-6;
}

export function datasetValidationMessage(rows: CustomRow[]): string | null {
  if (rows.length === 0) {
    return 'Add at least one training row.';
  }
  if (rows.some((row) => !isFiniteRow(row))) {
    return 'Every row needs finite numbers for x1, x2, and y.';
  }
  return null;
}

export function softmaxCustomValidationMessage(
  rows: CustomRow[],
  numClasses = SOFTMAX_CLASS_COUNT,
): string | null {
  const base = datasetValidationMessage(rows);
  if (base) {
    return base;
  }
  if (rows.some((row) => !isValidSoftmaxClass(row.y, numClasses))) {
    return `For softmax output, class (y) must be 0, 1, or ${numClasses - 1}.`;
  }
  return null;
}

export function customDatasetValidationMessage(
  rows: CustomRow[],
  outputActivation: string,
): string | null {
  if (outputActivation === 'softmax') {
    return softmaxCustomValidationMessage(rows);
  }
  return datasetValidationMessage(rows);
}

export function targetsOutsideUnitInterval(rows: CustomRow[]): boolean {
  return rows.some((row) => row.y < 0 || row.y > 1);
}

export function sigmoidTargetWarning(
  rows: CustomRow[],
  outputActivation: string = 'sigmoid',
): string | null {
  if (outputActivation !== 'sigmoid' || !targetsOutsideUnitInterval(rows)) {
    return null;
  }
  return 'Sigmoid output stays in (0, 1). Targets outside that range cannot be learned well. Try Linear output.';
}

export function isBinaryTarget(target: number): boolean {
  return target === 0 || target === 1;
}

/** Use error column instead of 0/5 threshold when any target is not exactly 0 or 1. */
export function usesRegressionDisplay(targets: number[]): boolean {
  return targets.some((target) => !isBinaryTarget(target));
}
