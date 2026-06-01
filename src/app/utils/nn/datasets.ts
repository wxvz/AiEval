import { TrainSample } from './network';

/**
 * XOR: output 1 when inputs differ, 0 when same.
 * Why XOR on the site?
 * - Not linearly separable → 0 hidden layers fails, 1+ hidden layer can succeed
 * - Classic “you need depth” demo
 */

export const XOR_DATASET: TrainSample[] = [
    {input: [0, 0], target: [0]},
    {input: [0, 1], target: [1]},
    {input: [1, 0], target: [1]},
    {input: [1, 1], target: [0]},
];

/**
 * AND: linearly separable — even [2, 1] (no hidden layer) can learn it.
 * Good contrast: "same code, easier problem."
 */

export const AND_DATASET: TrainSample[] = [
    { input: [0, 0], target: [0] },
    { input: [0, 1], target: [0] },
    { input: [1, 0], target: [0] },
    { input: [1, 1], target: [1] },
  ];