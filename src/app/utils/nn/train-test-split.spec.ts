import { describe, expect, it } from 'vitest';

import { NeuralNetwork } from './network';
import { accuracy, predictRow, rowsForRole, splitRows } from './train-test-split';

describe('train-test-split', () => {
  it('holds out one XOR corner as test', () => {
    const rows = splitRows('11');
    expect(rowsForRole(rows, 'test').map((row) => row.id)).toEqual(['11']);
    expect(rowsForRole(rows, 'train')).toHaveLength(3);
  });

  it('trains only on train rows when fitting', () => {
    const rows = splitRows('11');
    const net = new NeuralNetwork({
      layerSizes: [2, 4, 1],
      hiddenActivation: 'sigmoid',
      outputActivation: 'sigmoid',
      learningRate: 0.5,
    });
    const trainSamples = rowsForRole(rows, 'train').map((row) => ({
      input: [...row.input],
      target: [row.target],
    }));
    for (let epoch = 0; epoch < 200; epoch++) {
      net.trainEpoch(trainSamples);
    }
    const train = accuracy(rowsForRole(rows, 'train'), net);
    expect(train.correct).toBe(3);
    const testRow = rowsForRole(rows, 'test')[0]!;
    expect(predictRow(testRow, net).correct).toBe(false);
  });
});
