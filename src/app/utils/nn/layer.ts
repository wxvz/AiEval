import { Activation } from './activations';
import { addBiases, matVecMul, randomMatrix, zeros } from './math';

/**
 * Snapshot saved during forward — required for backprop.
 * Why cache? Backprop needs input, z, and output from the same forward pass.
 */
export interface LayerSnapshot {
    input: number[]; // x
    z: number[]; // pre-activation: Wx + b
    output: number[]; // post-activation: σ(z)
    weights: number[][]; // W
    biases: number[]; // b
}

export class Layer {
    weights: number[][]; 
    biases: number[];
    last: LayerSnapshot | null = null;

    constructor(
        public inSize: number, // number of input neurons
        public outSize: number, // number of output neurons
        private activation: Activation, // activation function
    ) {
        this.weights = randomMatrix(outSize, inSize);
        this.biases = zeros(1, outSize)[0]; // initialize biases to 0
    }

    forward(input: number[]): number[] {
        const z = addBiases(matVecMul(this.weights, input), this.biases); // pre-activation: Wx + b
        const output = z.map(this.activation.forward); 
        this.last = { input, z, output, weights: this.weights, biases: this.biases}; // save snapshot for backprop
        return output; // post-activation: σ(z)
    }

    /**
     * Backprop for this layer.
     * outputGrad = ∂loss/∂(this layer's outputs)
     * Returns gradients for weights, bias, and pass-through to previous layer.
    */
    backward(outputGrad: number[]): {
        inputGrad: number[];
        weightGrad: number[][];
        biasGrad: number[];
    } {
        if (!this.last) throw new Error('Call forward first');
        
        // Chain rule: ∂loss/∂z = ∂loss/∂output × ∂output/∂z
        const delta  = outputGrad.map(
            (g, i) => g * this.activation.derivativeFromOutput(this.last!.output[i]),
        );
        
        // ∂loss/∂W[i,j] = delta[i] × input[j]
        const weightGrad = delta.map((d) =>
          this.last!.input.map((inp) => d * inp) 
        );

        // ∂loss/∂b[i] = delta[i]
        const biasGrad = [...delta];

        // Pass gradient to previous layer: loss/∂input[j] = Σ_i delta[i] × W[i,j]
        const inputGrad = this.last.input.map((_, j) =>
            delta.reduce((sum, d, i) => sum + d * this.weights[i][j], 0),
        );

        return { inputGrad, weightGrad, biasGrad };
    }

    /** Gradient descent: W ← W − η × ∂loss/∂W */
    /** 
     * Apply gradients to weights and biases 
     * weightGrad: ∂loss/∂W
     * biasGrad: ∂loss/∂b
     * learningRate: η
    */
    applyGradients(weightGrad: number [][], biasGrad: number [], learningRate: number) {
        for (let i = 0; i < this.outSize; i++) {
            this.biases[i] -= learningRate * biasGrad[i];
            for (let j = 0; j < this.inSize; j++) {
                this.weights[i][j] -= learningRate * weightGrad[i][j];
            }
        }
    }

}