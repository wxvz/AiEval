import { CROSS_ENTROPY_EPS, resolveActivation, type ActivationName } from './activations';
import { cloneLayerSnapshot, Layer, LayerSnapshot } from './layer';

export interface TrainSample {
  input: number[];
  target: number[];
}

export interface NetworkConfig {
  layerSizes: number[];
  hiddenActivation: ActivationName;
  outputActivation: ActivationName;
  learningRate: number;
}

export interface TrainStepResult {
  loss: number;
  prediction: number[];
  layerSnapshots: LayerSnapshot[];
}

export class NeuralNetwork {
  layers: Layer[] = [];

  constructor(private config: NetworkConfig) {
    this.rebuild(config);
  }

  rebuild(config: NetworkConfig): void {
    if (config.hiddenActivation === 'softmax') {
      throw new Error('Softmax can only be used on the output layer.');
    }
    this.config = config;
    this.layers = [];
    const lastLayerIndex = config.layerSizes.length - 2;
    for (let i = 0; i <= lastLayerIndex; i++) {
      const inSize = config.layerSizes[i];
      const outSize = config.layerSizes[i + 1];
      const isOutput = i === lastLayerIndex;
      const actName = isOutput ? config.outputActivation : config.hiddenActivation;
      const act = resolveActivation(actName, isOutput);
      this.layers.push(new Layer(inSize, outSize, act));
    }
  }

  forward(input: number[]): number[] {
    return this.layers.reduce((acc, layer) => layer.forward(acc), input);
  }

  mseLoss(prediction: number[], target: number[]): number {
    const n = target.length;
    return prediction.reduce((sum, p, i) => sum + (p - target[i]) ** 2, 0) / n;
  }

  crossEntropyLoss(prediction: number[], target: number[]): number {
    const n = target.length;
    return (
      -prediction.reduce(
        (sum, p, i) => sum + target[i] * Math.log(Math.max(p, CROSS_ENTROPY_EPS)),
        0,
      ) / n
    );
  }

  /** @deprecated Use mseLoss or crossEntropyLoss explicitly. */
  loss(prediction: number[], target: number[]): number {
    return this.config.outputActivation === 'softmax'
      ? this.crossEntropyLoss(prediction, target)
      : this.mseLoss(prediction, target);
  }

  private expectedInputSize(): number {
    return this.config.layerSizes[0];
  }

  private expectedOutputSize(): number {
    return this.config.layerSizes[this.config.layerSizes.length - 1];
  }

  private assertTrainSample(sample: TrainSample): void {
    const inSize = this.expectedInputSize();
    const outSize = this.expectedOutputSize();
    if (sample.input.length !== inSize) {
      throw new Error(`Expected input length ${inSize}, got ${sample.input.length}.`);
    }
    if (sample.target.length !== outSize) {
      throw new Error(`Expected target length ${outSize}, got ${sample.target.length}.`);
    }
    if (
      sample.input.some((x) => !Number.isFinite(x)) ||
      sample.target.some((x) => !Number.isFinite(x))
    ) {
      throw new Error('Input and target must be finite numbers.');
    }
  }

  trainStep(sample: TrainSample): TrainStepResult {
    this.assertTrainSample(sample);
    const prediction = this.forward(sample.input);
    if (prediction.length !== sample.target.length) {
      throw new Error(
        `Prediction length ${prediction.length} does not match target length ${sample.target.length}.`,
      );
    }
    const useSoftmaxCe = this.config.outputActivation === 'softmax';
    const loss = useSoftmaxCe
      ? this.crossEntropyLoss(prediction, sample.target)
      : this.mseLoss(prediction, sample.target);

    let grad = useSoftmaxCe
      ? prediction.map((p, i) => p - sample.target[i])
      : prediction.map((p, i) => (2 / sample.target.length) * (p - sample.target[i]));

    const snapshots: LayerSnapshot[] = [];

    for (let i = this.layers.length - 1; i >= 0; i--) {
      snapshots.unshift(cloneLayerSnapshot(this.layers[i].last!));
      const { inputGrad, weightGrad, biasGrad } = this.layers[i].backward(grad);
      this.layers[i].applyGradients(weightGrad, biasGrad, this.config.learningRate);
      grad = inputGrad;
    }

    return { loss, prediction, layerSnapshots: snapshots };
  }

  trainEpoch(samples: TrainSample[]): { avgLoss: number; lastStep: TrainStepResult } {
    if (samples.length === 0) {
      throw new Error('trainEpoch requires at least one training sample.');
    }
    let total = 0;
    let last!: TrainStepResult;
    for (const sample of samples) {
      last = this.trainStep(sample);
      total += last.loss;
    }
    return { avgLoss: total / samples.length, lastStep: last };
  }
}
