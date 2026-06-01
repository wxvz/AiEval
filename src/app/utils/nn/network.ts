import { ACTIVATIONS, ActivationName } from './activations';
import { Layer, LayerSnapshot } from './layer';

export interface TrainSample {
  input: number[]; // input to the network
  target: number[]; // expected output
}

export interface NetworkConfig {
  layerSizes: number[]; // e.g. [2, 4, 1] = input, hidden, output
  hiddenActivation: ActivationName;
  outputActivation: ActivationName;
  learningRate: number; // η — how big each weight update is
}

export interface TrainStepResult {
  loss: number; // how far off the prediction is from the target
  prediction: number[]; // what the network predicted
  layerSnapshots: LayerSnapshot[];
}

export class NeuralNetwork {
  layers: Layer[] = [];

  constructor(private config: NetworkConfig) {
    this.rebuild(config);
  }

  /** Rebuild when user changes architecture or activations */
  rebuild(config: NetworkConfig): void {
    this.config = config;
    this.layers = [];
    for (let i = 0; i < config.layerSizes.length - 1; i++) {
      const inSize = config.layerSizes[i];
      const outSize = config.layerSizes[i + 1];
      const isOutput = i === config.layerSizes.length - 2;
      const act = ACTIVATIONS[isOutput ? config.outputActivation : config.hiddenActivation];
      this.layers.push(new Layer(inSize, outSize, act));
    }
  }

  /** Feed input through every layer in order */
  forward(input: number[]): number[] {
    return this.layers.reduce((acc, layer) => layer.forward(acc), input);
  }

  /**
   * Mean Squared Error — average of (prediction − target)².
   * Why MSE? Smooth, simple derivative, good for teaching regression / XOR.
   * Calculate MSE loss between prediction and target
   * @param prediction - what the network predicted
   * @param target - what the network should have predicted
   * @returns MSE loss
   */
  loss(prediction: number[], target: number[]): number {
    const n = target.length;
    return prediction.reduce((sum, p, i) => sum + (p - target[i]) ** 2, 0) / n;
  }

  /**
   * One training step on one sample:
   * forward → compute loss → backprop → update weights.
   */
  trainStep(sample: TrainSample): TrainStepResult {
    const prediction = this.forward(sample.input);
    const loss = this.loss(prediction, sample.target);

    // ∂(MSE)/∂prediction_i = (2/n) × (prediction_i − target_i)
    let grad = prediction.map((p, i) => (2 / sample.target.length) * (p - sample.target[i]));

    const snapshots: LayerSnapshot[] = [];

    /** Backpropagate from last layer to first */
    for (let i = this.layers.length - 1; i >= 0; i--) {
      snapshots.unshift(this.layers[i].last!);
      const { inputGrad, weightGrad, biasGrad } = this.layers[i].backward(grad);
      this.layers[i].applyGradients(weightGrad, biasGrad, this.config.learningRate);
      grad = inputGrad; // gradient w.r.t. this layer's input = next layer's outputGrad
    }

    return { loss, prediction, layerSnapshots: snapshots };
  }

  /** One epoch = one update per sample (order can matter for tiny nets; fine for XOR) */
  trainEpoch(samples: TrainSample[]): { avgLoss: number; lastStep: TrainStepResult } {
    let total = 0;
    let last!: TrainStepResult;
    for (const sample of samples) {
      last = this.trainStep(sample);
      total += last.loss;
    }
    return { avgLoss: total / samples.length, lastStep: last };
  }
}
