import { Activation, ElementwiseActivation, isVectorActivation } from './activations';
import { addBiases, matVecMul, randomMatrix, zeros } from './math';

/**
 * Snapshot saved during forward — required for backprop.
 * Why cache? Backprop needs input, z, and output from the same forward pass.
 */
export interface LayerSnapshot {
  input: number[];
  z: number[];
  output: number[];
  weights: number[][];
  biases: number[];
}

/** Deep copy for TrainStepResult — live layer weights are updated in place during backprop. */
export function cloneLayerSnapshot(snapshot: LayerSnapshot): LayerSnapshot {
  return {
    input: [...snapshot.input],
    z: [...snapshot.z],
    output: [...snapshot.output],
    weights: snapshot.weights.map((row) => [...row]),
    biases: [...snapshot.biases],
  };
}

export class Layer {
  weights: number[][];
  biases: number[];
  last: LayerSnapshot | null = null;

  constructor(
    public inSize: number,
    public outSize: number,
    private activation: Activation,
  ) {
    this.weights = randomMatrix(outSize, inSize);
    this.biases = zeros(1, outSize)[0];
  }

  forward(input: number[]): number[] {
    const z = addBiases(matVecMul(this.weights, input), this.biases);
    const act = this.activation;
    const output = isVectorActivation(act)
      ? act.forwardVector(z)
      : z.map((x) => (act as ElementwiseActivation).forward(x));
    this.last = { input, z, output, weights: this.weights, biases: this.biases };
    return output;
  }

  /**
   * Backprop for this layer.
   * outputGrad = ∂loss/∂(this layer's outputs), or ∂loss/∂z for softmax+CE on the output layer.
   */
  backward(outputGrad: number[]): {
    inputGrad: number[];
    weightGrad: number[][];
    biasGrad: number[];
  } {
    if (!this.last) {
      throw new Error('Call forward first');
    }

    const act = this.activation;
    const delta = isVectorActivation(act)
      ? outputGrad
      : outputGrad.map((g, i) => g * (act as ElementwiseActivation).derivativeFromOutput(this.last!.output[i]));

    const weightGrad = delta.map((d) => this.last!.input.map((inp) => d * inp));
    const biasGrad = [...delta];
    const inputGrad = this.last.input.map((_, j) =>
      delta.reduce((sum, d, i) => sum + d * this.weights[i][j], 0),
    );

    return { inputGrad, weightGrad, biasGrad };
  }

  applyGradients(weightGrad: number[][], biasGrad: number[], learningRate: number): void {
    for (let i = 0; i < this.outSize; i++) {
      this.biases[i] -= learningRate * biasGrad[i];
      for (let j = 0; j < this.inSize; j++) {
        this.weights[i][j] -= learningRate * weightGrad[i][j];
      }
    }
  }
}
