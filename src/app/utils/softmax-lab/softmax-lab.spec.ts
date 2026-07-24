import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SOFTMAX_SCORES,
  isSoftmaxLabSolved,
  probabilitiesFromScores,
} from './softmax-lab';

describe('softmax-lab', () => {
  it('returns probabilities that sum to about 1', () => {
    const probs = probabilitiesFromScores(DEFAULT_SOFTMAX_SCORES);
    const sum = probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('is unsolved on the default scores', () => {
    expect(isSoftmaxLabSolved(DEFAULT_SOFTMAX_SCORES)).toBe(false);
  });

  it('is solved when Dog is the clear winner', () => {
    expect(isSoftmaxLabSolved([-1, 2.5, -1])).toBe(true);
  });
});
