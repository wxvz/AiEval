/** A 2D grid of numbers */
export type Matrix = number[][];

/** Create a matrix of zeros for biases and gradients */
export function zeros(rows: number, cols: number): Matrix {
    return Array.from({ length: rows }, () => Array(cols).fill(0))
}

/** 
 * Random small weights so the network starts at non zero 
 * All zeros mean all neurons are the same, which means no learning can happen
 * Scale  ~0.5 keeps sigmoid inputs in a useful range early on
*/
export function randomMatrix(rows: number, cols: number, scale = 0.5): Matrix {
    return Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => (Math.random() * 2 - 1) * scale)
    ); 
}

/**
 * Matrix × vector: core of "weighted sum" for each neuron.
 * Row i of weights dotted with input = pre-activation of neuron i.
 */
export function matVecMul(matrix: Matrix, vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, weight, j) => sum + weight * vector[j], 0));
}

/** Each neuron adds its own bias after the weighted sum */
export function addBiases(values: number[], biases: number[]): number[] {
    return values.map((value, i) => value + biases[i]);
}

/** Element wise multiplication used in backprop ( chain rule ) */
export function hadamardProduct(a: number[], b: number[]): number[] {
    return a.map((v, i) => v * b[i]);
}

/** Add two vectors element wise */
export function addVectors(a: number[], b: number[]): number[] {
    return a.map((v, i) => v + b[i]);
}


export function scaleVector(a: number[], scale: number): number[] {
    return a.map((x) => x * scale);
}