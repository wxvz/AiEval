import { TrainSample } from './network';

export type EntryStyle = 'binary' | 'free';

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

export function toTrainSample(row: CustomRow): TrainSample {
  return { input: [row.x1, row.x2], target: [row.y] };
}

export function toDataset(rows: CustomRow[]): TrainSample[] {
  return rows.map(toTrainSample);
}

export function isFiniteRow(row: CustomRow): boolean {
  return Number.isFinite(row.x1) && Number.isFinite(row.x2) && Number.isFinite(row.y);
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
  return 'Sigmoid output stays in (0, 1). Targets outside that range cannot be learned well — try Linear output.';
}

export function isBinaryTarget(target: number): boolean {
  return target === 0 || target === 1;
}

/** Use error column instead of 0/5 threshold when any target is not exactly 0 or 1. */
export function usesRegressionDisplay(targets: number[]): boolean {
  return targets.some((target) => !isBinaryTarget(target));
}
