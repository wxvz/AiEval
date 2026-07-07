import { describe, expect, it } from 'vitest';

import { softmaxForward, softmaxBackwardFromOutputGrad } from './activations';

describe('softmax', () => {
  it('forward produces positive values that sum to 1', () => {
    const out = softmaxForward([1, 2, 3]);
    expect(out.every((p) => p > 0)).toBe(true);
    expect(out.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(out[2]).toBeGreaterThan(out[1]);
    expect(out[1]).toBeGreaterThan(out[0]);
  });

  it('backwardFromOutputGrad matches prediction minus target for CE shortcut', () => {
    const z = [0.5, 1, -0.5];
    const output = softmaxForward(z);
    const target = [0, 1, 0];
    const outputGrad = output.map((p, i) => -target[i] / Math.max(p, 1e-12));
    const gradZ = softmaxBackwardFromOutputGrad(outputGrad, output);
    for (let i = 0; i < 3; i++) {
      expect(gradZ[i]).toBeCloseTo(output[i] - target[i], 4);
    }
  });
});
