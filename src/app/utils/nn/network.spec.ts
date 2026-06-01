import { describe, it, expect } from 'vitest';
import { XOR_DATASET } from './datasets';
import { NeuralNetwork, type TrainSample } from './network';

const TARGET_TWO_DATASET: TrainSample[] = [{ input: [1, 0], target: [2] }];

describe('NeuralNetwork', () => {
  it('learns XOR after many epochs', () => {
    const network = new NeuralNetwork({
      layerSizes: [2, 4, 1],
      hiddenActivation: 'sigmoid',
      outputActivation: 'sigmoid',
      learningRate: 0.5,
    });

    for (let epoch = 0; epoch < 5000; epoch++) {
      network.trainEpoch(XOR_DATASET);
    }

    for (const { input, target } of XOR_DATASET) {
      const out = network.forward(input)[0];
      expect(out).toBeCloseTo(target[0], 1);
    }
  });

  it('linear output learns regression target 2 with low final loss', () => {
    const network = new NeuralNetwork({
      layerSizes: [2, 4, 1],
      hiddenActivation: 'sigmoid',
      outputActivation: 'linear',
      learningRate: 0.5,
    });

    let lastAvgLoss = Infinity;
    for (let epoch = 0; epoch < 8000; epoch++) {
      lastAvgLoss = network.trainEpoch(TARGET_TWO_DATASET).avgLoss;
    }

    expect(lastAvgLoss).toBeLessThan(0.05);
    expect(network.forward([1, 0])[0]).toBeCloseTo(2, 1);
  });

  it('sigmoid output cannot fit target 2 — final loss stays high', () => {
    const network = new NeuralNetwork({
      layerSizes: [2, 4, 1],
      hiddenActivation: 'sigmoid',
      outputActivation: 'sigmoid',
      learningRate: 0.5,
    });

    let lastAvgLoss = 0;
    for (let epoch = 0; epoch < 8000; epoch++) {
      lastAvgLoss = network.trainEpoch(TARGET_TWO_DATASET).avgLoss;
    }

    expect(lastAvgLoss).toBeGreaterThan(0.5);
    expect(network.forward([1, 0])[0]).toBeLessThan(1.5);
  });
});