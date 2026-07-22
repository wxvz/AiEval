/**
 * Without activation, stacking layers is still one big linear map.
 * Non-linearity lets the net learn curves and boundaries.
 */

export type ElementwiseActivationName = 'sigmoid' | 'relu' | 'tanh' | 'linear';
export type ActivationName = ElementwiseActivationName | 'softmax';

export interface ElementwiseActivation {
  readonly kind: 'elementwise';
  readonly name: ElementwiseActivationName;
  forward(x: number): number;
  /**
   * Derivative σ'(z) from output σ(z).
   * Reuse forward output — cheaper and stable for sigmoid.
   */
  derivativeFromOutput(out: number): number;
}

export interface VectorActivation {
  readonly kind: 'vector';
  readonly name: 'softmax';
  forwardVector(z: number[]): number[];
  /**
   * ∂loss/∂z given ∂loss/∂output and cached z, output.
   * With cross-entropy on the output layer, NeuralNetwork passes ∂loss/∂z directly
   * and Layer.backward uses outputGrad as delta (skips this Jacobian).
   */
  backwardVector(outputGrad: number[], z: number[], output: number[]): number[];
}

export type Activation = ElementwiseActivation | VectorActivation;

export function isVectorActivation(act: Activation): act is VectorActivation {
  return act.kind === 'vector';
}

const LOG_EPS = 1e-12;

/** Stable softmax: subtract max(z) before exp so values stay finite. */
export function softmaxForward(z: number[]): number[] {
  const maxZ = Math.max(...z);
  const exps = z.map((x) => Math.exp(x - maxZ));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/**
 * ∂loss/∂z for softmax output when loss is cross-entropy on probabilities.
 * Jacobian J_ij = p_i(δ_ij − p_j); (dL/dz)_i = Σ_j (dL/dp_j) J_ji.
 */
export function softmaxBackwardFromOutputGrad(
  outputGrad: number[],
  output: number[],
): number[] {
  const dot = outputGrad.reduce((sum, g, j) => sum + g * output[j], 0);
  return output.map((p, i) => output[i] * (outputGrad[i] - dot));
}

export const ELEMENTWISE_ACTIVATIONS: Record<ElementwiseActivationName, ElementwiseActivation> = {
  sigmoid: {
    kind: 'elementwise',
    name: 'sigmoid',
    forward: (x) => 1 / (1 + Math.exp(-x)),
    derivativeFromOutput: (out) => out * (1 - out),
  },
  relu: {
    kind: 'elementwise',
    name: 'relu',
    forward: (x) => (x > 0 ? x : 0),
    derivativeFromOutput: (out) => (out > 0 ? 1 : 0),
  },
  tanh: {
    kind: 'elementwise',
    name: 'tanh',
    forward: (x) => Math.tanh(x),
    derivativeFromOutput: (out) => 1 - out * out,
  },
  linear: {
    kind: 'elementwise',
    name: 'linear',
    forward: (x) => x,
    derivativeFromOutput: () => 1,
  },
};

export const SOFTMAX_ACTIVATION: VectorActivation = {
  kind: 'vector',
  name: 'softmax',
  forwardVector: softmaxForward,
  backwardVector: softmaxBackwardFromOutputGrad,
};

export function resolveActivation(name: ActivationName, isOutputLayer: boolean): Activation {
  if (name === 'softmax') {
    if (!isOutputLayer) {
      throw new Error('Softmax can only be used on the output layer.');
    }
    return SOFTMAX_ACTIVATION;
  }
  return ELEMENTWISE_ACTIVATIONS[name];
}

/** @deprecated Use activateVector on z with elementwise forward, or forwardVector for softmax. */
export function activateVector(v: number[], fn: (x: number) => number): number[] {
  return v.map(fn);
}

export { LOG_EPS as CROSS_ENTROPY_EPS };
