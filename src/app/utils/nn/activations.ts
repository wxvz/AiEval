/**
 * Without activation, stacking layers is still one big linear map.
 * Non-linearity lets the net learn curves and boundaries
 * ask about softmax
 */

export type ActivationName = 'sigmoid' | 'relu' | 'tanh' | 'linear';

export interface Activation {
  name: ActivationName;
  /** Apply non linearity to pre activation z */
  forward(x: number): number;
  /**
   * Derivative σ'(z) computed from output σ(z).
   * Why from output? We already computed σ(z) in forward — reuse it (cheaper + stable for sigmoid).
   */
  derivativeFromOutput(out: number): number;
}

export const ACTIVATIONS: Record<ActivationName, Activation> = {
  sigmoid: {
    name: 'sigmoid',
    forward: (x) => 1 / (1 + Math.exp(-x)),
    // If out = σ(z), then σ'(z) = out * (1 - out)
    derivativeFromOutput: (out) => out * (1 - out),
  },
  relu: {
    name: 'relu',
    forward: (x) => (x > 0 ? x : 0),
    // ReLU: 1 if neuron fired, else 0
    derivativeFromOutput: (out) => (out > 0 ? 1 : 0),
  },
  tanh: {
    name: 'tanh',
    forward: (x) => Math.tanh(x),
    // d/dx tanh(x) = 1 - tanh²(x)
    derivativeFromOutput: (out) => 1 - out * out,
  },
  linear: {
    name: 'linear',
    forward: (x) => x,
    derivativeFromOutput: () => 1,
  },
};

/** Apply activation to every neuron in a layer at once */
export function activateVector(v: number[], fn: (x: number) => number): number[] {
  return v.map(fn);
}
