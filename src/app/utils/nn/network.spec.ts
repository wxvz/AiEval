import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THREE_CLASS_DATASET, XOR_DATASET } from './datasets';
import { NeuralNetwork, type TrainSample } from './network';

const TARGET_TWO_DATASET: TrainSample[] = [{ input: [1, 0], target: [2] }];

function argmax(values: number[]): number {
  return values.reduce((best, v, i, arr) => (v > arr[best] ? i : best), 0);
}

/** Fixed weight init so learning tests are stable across CI runs (see aieval-nn-core). */
function stubDeterministicRandom(seed = 12_345): void {
  let state = seed;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    state = (state * 16_807) % 2_147_483_647;
    return (state - 1) / 2_147_483_646;
  });
}

describe('NeuralNetwork', () => {
  beforeEach(() => {
    stubDeterministicRandom();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
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

  it('learns XOR with ReLU hidden layer', () => {
    const network = new NeuralNetwork({
      layerSizes: [2, 4, 1],
      hiddenActivation: 'relu',
      outputActivation: 'sigmoid',
      learningRate: 0.5,
    });

    for (let epoch = 0; epoch < 12000; epoch++) {
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

  it('learns THREE_CLASS_DATASET with softmax output and cross-entropy', () => {
    const network = new NeuralNetwork({
      layerSizes: [2, 4, 3],
      hiddenActivation: 'relu',
      outputActivation: 'softmax',
      learningRate: 0.5,
    });

    let lastAvgLoss = Infinity;
    for (let epoch = 0; epoch < 12000; epoch++) {
      lastAvgLoss = network.trainEpoch(THREE_CLASS_DATASET).avgLoss;
    }

    for (const { input, target } of THREE_CLASS_DATASET) {
      const pred = network.forward(input);
      expect(argmax(pred)).toBe(argmax(target));
    }

    expect(lastAvgLoss).toBeLessThan(0.2);
  });

  it('rejects softmax on the hidden layer', () => {
    expect(
      () =>
        new NeuralNetwork({
          layerSizes: [2, 4, 1],
          hiddenActivation: 'softmax',
          outputActivation: 'sigmoid',
          learningRate: 0.5,
        }),
    ).toThrow(/output layer/i);
  });

  it('rejects trainEpoch with no samples', () => {
    const network = new NeuralNetwork({
      layerSizes: [2, 4, 1],
      hiddenActivation: 'sigmoid',
      outputActivation: 'sigmoid',
      learningRate: 0.5,
    });
    expect(() => network.trainEpoch([])).toThrow(/at least one training sample/i);
  });

  it('rejects trainStep when input or target length mismatches architecture', () => {
    const network = new NeuralNetwork({
      layerSizes: [2, 4, 1],
      hiddenActivation: 'sigmoid',
      outputActivation: 'sigmoid',
      learningRate: 0.5,
    });
    expect(() => network.trainStep({ input: [0], target: [0] })).toThrow(/input length/i);
    expect(() => network.trainStep({ input: [0, 0], target: [0, 1] })).toThrow(/target length/i);
  });

  it('returns layerSnapshots that are not mutated by applyGradients', () => {
    const network = new NeuralNetwork({
      layerSizes: [2, 4, 1],
      hiddenActivation: 'sigmoid',
      outputActivation: 'sigmoid',
      learningRate: 0.5,
    });
    const { layerSnapshots } = network.trainStep(XOR_DATASET[0]);
    const weightBefore = layerSnapshots[0].weights[0][0];
    network.layers[0].weights[0][0] = -999;
    expect(layerSnapshots[0].weights[0][0]).toBe(weightBefore);
  });
});
