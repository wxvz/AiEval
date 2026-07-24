import { describe, expect, it } from 'vitest';

import {
  isLearningRateLabSolved,
  lossAt,
  runSteps,
  stepWeight,
} from './learning-rate-lab';

describe('learning-rate-lab', () => {
  it('reduces loss with a medium rate from a far start', () => {
    const { losses } = runSteps(0, 'medium', 8);
    expect(losses[losses.length - 1]!).toBeLessThan(losses[0]!);
  });

  it('overshoots with a huge rate from the same start', () => {
    const medium = runSteps(0, 'medium', 6);
    const huge = runSteps(0, 'huge', 6);
    expect(huge.losses[huge.losses.length - 1]!).toBeGreaterThan(
      medium.losses[medium.losses.length - 1]!,
    );
  });

  it('marks the lab solved when medium wins cleanly', () => {
    const medium = runSteps(0, 'medium', 10);
    const huge = runSteps(0, 'huge', 10);
    expect(
      isLearningRateLabSolved(
        medium.losses[medium.losses.length - 1]!,
        huge.losses[huge.losses.length - 1]!,
      ),
    ).toBe(true);
  });

  it('computes squared loss against the target', () => {
    expect(lossAt(2)).toBe(0);
    expect(lossAt(0)).toBe(4);
  });

  it('steps downhill for a tiny rate', () => {
    const next = stepWeight(0, 'tiny');
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(2);
  });
});
