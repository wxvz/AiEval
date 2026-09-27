---
name: aieval-nn-core
description: >-
  Documents AiEval's teaching neural network engine (forward pass, MSE loss,
  backprop, activations) under src/app/utils/nn. Use when modifying Layer,
  NeuralNetwork, activations, math helpers, datasets, or network.spec.ts tests.
---

# NN core engine (maintainer)

Pure TypeScript — no Angular imports. Used by the playground page and Vitest specs.

## File map

| File | Role |
|------|------|
| `network.ts` | `NeuralNetwork`, `trainStep`, MSE or cross-entropy loss by output activation |
| `layer.ts` | `Layer`, element-wise or vector (softmax) forward/backward |
| `activations.ts` | `ELEMENTWISE_ACTIVATIONS`, `SOFTMAX_ACTIVATION`, `resolveActivation` |
| `math.ts` | `matVecMul`, `randomMatrix`, `zeros`, vector ops |
| `datasets.ts` | `XOR_DATASET`, `AND_DATASET`, `THREE_CLASS_DATASET` |
| `network.spec.ts` | Golden learning tests (XOR, ReLU+XOR, softmax 3-class, regression) |
| `activations.spec.ts` | Softmax forward sums to 1; Jacobian vs CE shortcut |

## Architecture conventions

- **`layerSizes`**: `[input, …hidden…, output]` — e.g. `[2, 4, 1]` = 2 inputs, 4 hidden, 1 output.
- **Activations**: last layer uses `outputActivation`; all earlier layers use `hiddenActivation`.
- **Loss**: MSE for `sigmoid` / `linear` output (`(2/n) × (pred − target)` grad). Cross-entropy for `softmax` output (`pred − target` grad w.r.t. logits).
- **Training unit**: `trainEpoch` = one `trainStep` per sample (full-batch over tiny sets).
- **Rebuild**: call `rebuild(config)` or construct a new `NeuralNetwork` when architecture or η changes — do not mutate `layerSizes` in place without rebuild.

## Layer / backprop invariants

1. **`forward` must run before `backward`** — `Layer.last` holds the snapshot (`input`, `z`, `output`, weights, biases).
2. **Backprop order**: last layer → first; each layer returns `inputGrad` for the previous layer.
3. **Chain rule in `Layer.backward`**: element-wise `delta[i] = outputGrad[i] × σ'(output[i])`; softmax output layer uses `delta = outputGrad` when `trainStep` passes CE grad `p − t`.
4. **Weight init**: `randomMatrix(out, in, scale=0.5)` — not zeros (symmetry breaks learning).
5. **Bias init**: zeros via `zeros(1, outSize)[0]`.

## Adding an activation

**Element-wise** (sigmoid, relu, tanh, linear):

1. Extend `ElementwiseActivationName` / `ActivationName`.
2. Add to `ELEMENTWISE_ACTIVATIONS` with `forward` + `derivativeFromOutput`.
3. `Layer` applies `z.map(forward)`.

**Vector** (softmax):

1. Add `forwardVector` on `VectorActivation`; use `resolveActivation(name, isOutputLayer)`.
2. `Layer.forward` calls `forwardVector(z)` on the full pre-activation vector.
3. Output loss must be cross-entropy in `trainStep`; `hiddenActivation` cannot be `softmax`.
4. Wire UI in playground separately — see `aieval-nn-playground`.

## Datasets

- **XOR**: not linearly separable — needs hidden layer; classic “depth matters” demo.
- **AND**: linearly separable — easier contrast with same network code.
- Shape: `{ input: number[], target: number[] }` — playground uses scalar targets in `target[0]`.

## Testing

Run (frontend — use `npm test`, not root Vitest):

```bash
npm test -- --include='src/app/utils/nn/**/*.spec.ts'
```

Before merge: `npm run ci` (see `aieval-keep-tests-current`).

| Test | What it guards |
|------|----------------|
| XOR @ 5000 epochs, `[2,4,1]` sigmoid hidden | Non-linear problem |
| XOR @ 12000 epochs, ReLU hidden | ReLU wiring |
| THREE_CLASS @ 12000 epochs, `[2,4,3]` softmax + CE | Multi-class; argmax matches target |
| `hiddenActivation: 'softmax'` | Throws (output layer only) |
| Target `2` + `linear` output | Regression fits; `avgLoss < 0.05` |
| Target `2` + `sigmoid` output | Sigmoid cannot reach 2; loss stays high |

Use `toBeCloseTo(..., 1)` for binary outputs; assert **loss thresholds** for regression, not just point predictions.

When changing learning dynamics, adjust epoch counts in specs rather than weakening assertions.

## Common pitfalls

| Symptom | Likely cause |
|---------|----------------|
| Loss flat / no learning | Zero weights, wrong grad sign, or `forward` not called before `backward` |
| XOR never converges | Too few hidden neurons, lr too low/high, or output activation mismatch |
| Regression stuck with sigmoid | Output squashed to (0,1) — use `linear` output (see `network.spec.ts`) |
| Flaky XOR test | `network.spec.ts` stubs `Math.random` with a fixed seed; increase epochs if a new test fails |

## Backprop reference

For derivative formulas and tensor shapes, see [reference.md](reference.md).

## Related skills

- `aieval-nn-playground` — Angular UI, glossary, custom dataset validation
