---
name: aieval-nn-playground
description: >-
  Guides AiEval's neural network learning page at /learn/labs/neural-network — Angular
  signals, predictions table, glossary hints, custom datasets, and validation UX.
  Use when editing nn-playground, nn-term-hint, nn-glossary, or dataset-validation.
---

# NN playground (maintainer)

Interactive teaching page: adjust hidden size, learning rate, and dataset; step or batch-train; view predictions and loss.

## Route and entry points

| Path | Component |
|------|-----------|
| `/learn/labs/neural-network` | `NnPlaygroundPage` (`src/app/pages/nn-playground/`) |
| `/learn/neural-network` | redirect → `/learn/labs/neural-network` |
| `/learn` | `LearnPage` curriculum hub |
| Navbar | “Learn” → `routerLink="/learn"` |

## File map

| File | Role |
|------|------|
| `nn-playground.ts` | Signals, `NeuralNetwork` lifecycle, train/reset |
| `nn-playground.html` | Controls, predictions table, loss display |
| `nn-term-hint/` | Click-to-expand glossary popover |
| `nn-glossary.ts` | `NN_GLOSSARY`, `NnGlossaryTerm` union |
| `dataset-validation.ts` | Custom row parsing, validation messages, sigmoid warning |

Engine math lives in `src/app/utils/nn/` — see `aieval-nn-core`.

## Angular patterns

### Keep UI in sync after weight updates

`NeuralNetwork` is a plain class; Angular does not detect in-place weight changes. Bump `weightRevision` after every train step, reset, or config change so `predictions` computed re-runs:

```typescript
readonly predictions = computed(() => {
  this.weightRevision();
  return this.dataset().map(/* forward + target */);
});
```

### Recreate network on config change

`onConfigChange()` and `resetNetwork()` must **`new NeuralNetwork(...)`** (or `rebuild`) — not only clear history. Hidden size and learning rate change architecture or η.

### Async batch training

`train(steps)` loops `stepOnce()` and yields with `setTimeout(0)` every 5 steps so the UI stays responsive. Disable buttons via `isTraining` while running.

## Predictions table

- **Binary display**: row is “correct” when `(output > 0.5) === (target > 0.5)` — threshold classification for 0/1 targets.
- **Regression display** (custom datasets): use `usesRegressionDisplay(targets)` from `dataset-validation.ts` — show error column when any target is not exactly 0 or 1.

## Glossary and term hints

1. Add term to `NnGlossaryTerm` union in `nn-glossary.ts`.
2. Add `NN_GLOSSARY[term]` with `label` + plain-language `explanation`.
3. In template: `<app-nn-term-hint term="xor" [activeId]="..." (activeIdChange)="..." />`.
4. Parent page holds `activeHintId` signal — only one popover open; component closes on outside click / Escape.

Keep glossary wording aligned with on-page copy (XOR needs hidden layer, sigmoid range, etc.).

## Custom datasets (when wired in UI)

| Helper | Purpose |
|--------|---------|
| `parseField(value, 'binary' \| 'free')` | Snap to 0/1 or accept any finite float |
| `datasetValidationMessage(rows)` | Empty or non-finite row errors |
| `sigmoidTargetWarning(rows, outputActivation)` | Warn when targets outside (0,1) with sigmoid output |
| `toDataset(rows)` | `CustomRow[]` → `TrainSample[]` |

Validation is pure functions — test in `dataset-validation.spec.ts`.

## Default playground config

- Architecture: `[2, hiddenSize, outputSize]` where `outputSize` is 3 when output is `softmax`, else 1.
- Hidden activation: user-selectable sigmoid / relu / tanh (`hiddenActivation` signal).
- Output activation: sigmoid / linear / softmax; switching to softmax auto-selects `three-class` dataset if XOR/AND was active.
- Datasets: XOR, AND, `three-class` (`THREE_CLASS_DATASET`), custom rows.
- Custom + softmax: `y` is class index 0–2; `toDataset(rows, 'softmax')` expands to one-hot via `dataset-validation.ts`.

## Change checklist

- [ ] Config change recreates network and clears loss history
- [ ] Training updates `weightRevision`
- [ ] New glossary term added to union + `NN_GLOSSARY` + template hints
- [ ] Custom dataset changes have spec coverage in `dataset-validation.spec.ts`
- [ ] Engine changes coordinated with `aieval-nn-core` and `network.spec.ts`

## Running tests

```bash
npm test -- src/app/utils/nn/dataset-validation.spec.ts
npm test -- src/app/utils/nn/network.spec.ts
```

Before merge: `npm run ci` (see `aieval-keep-tests-current`).

## Related skills

- `aieval-nn-core` — Layer, backprop, activations, golden XOR/regression tests
- `aieval-learn-hub` — curriculum hub, lesson JSON, progress
