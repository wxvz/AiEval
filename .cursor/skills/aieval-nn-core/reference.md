# NN backprop reference

Teaching MLP with full-batch steps on tiny 2-input datasets.

## Forward (one layer)

```
z = W · x + b          (matVecMul + addBiases)
output = σ(z)          (element-wise: forward per neuron)
output = softmax(z)    (vector: all outputs at once on last layer)
```

Weights: `W[i][j]` = weight from input `j` to neuron `i`.

## MSE loss (n outputs)

```
L = (1/n) Σ (p_i − t_i)²
∂L/∂p_i = (2/n) × (p_i − t_i)
```

`NeuralNetwork.trainStep` seeds backprop with this vector as `grad` (sigmoid/linear output only).

## Cross-entropy + softmax (n classes)

```
L = -(1/n) Σ t_i log(p_i)     (p = softmax(z), epsilon in log)
∂L/∂z_i = p_i − t_i           (combined; trainStep uses this as grad into output layer)
```

`Layer.backward` on softmax output: `delta = outputGrad` (already ∂L/∂z).

## Layer backward

Given `outputGrad = ∂L/∂(layer outputs)`:

```
delta[i] = outputGrad[i] × σ'(output[i])     // derivativeFromOutput
∂L/∂W[i,j] = delta[i] × input[j]
∂L/∂b[i] = delta[i]
∂L/∂input[j] = Σ_i delta[i] × W[i,j]
```

Update (learning rate η):

```
W[i,j] ← W[i,j] − η × ∂L/∂W[i,j]
b[i]   ← b[i]   − η × ∂L/∂b[i]
```

## Activation derivatives (from stored output)

| Name | σ(z) | σ'(z) via output |
|------|------|------------------|
| sigmoid | 1/(1+e^−z) | out × (1 − out) |
| relu | max(0, z) | out > 0 ? 1 : 0 |
| tanh | tanh(z) | 1 − out² |
| linear | z | 1 |
| softmax | e^z_i / Σ e^z_j (stable) | vector; CE grad p − t |

## Shapes (layer with inSize=m, outSize=n)

| Tensor | Shape |
|--------|-------|
| input | [m] |
| weights | [n][m] |
| biases | [n] |
| z, output, delta | [n] |
| weightGrad | [n][m] |
