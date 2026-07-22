import { NeuralNetwork } from './network';

export type SplitRole = 'train' | 'test';

export interface SplitRow {
  id: string;
  input: [number, number];
  target: number;
  role: SplitRole;
}

export const XOR_SPLIT_ROWS: Omit<SplitRow, 'role'>[] = [
  { id: '00', input: [0, 0], target: 0 },
  { id: '01', input: [0, 1], target: 1 },
  { id: '10', input: [1, 0], target: 1 },
  { id: '11', input: [1, 1], target: 0 },
];

export function splitRows(testId: string): SplitRow[] {
  return XOR_SPLIT_ROWS.map((row) => ({
    ...row,
    role: row.id === testId ? 'test' : 'train',
  }));
}

export function rowsForRole(rows: SplitRow[], role: SplitRole): SplitRow[] {
  return rows.filter((row) => row.role === role);
}

export interface RowPrediction {
  output: number;
  predicted: number;
  correct: boolean;
}

export function predictRow(row: SplitRow, net: NeuralNetwork): RowPrediction {
  const output = net.forward([...row.input])[0];
  const predicted = output > 0.5 ? 1 : 0;
  return {
    output,
    predicted,
    correct: predicted === row.target,
  };
}

export function accuracy(rows: SplitRow[], net: NeuralNetwork): { correct: number; total: number } {
  let correct = 0;
  for (const row of rows) {
    if (predictRow(row, net).correct) {
      correct++;
    }
  }
  return { correct, total: rows.length };
}
