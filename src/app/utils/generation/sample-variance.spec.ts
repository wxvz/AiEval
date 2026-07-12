import { describe, expect, it } from 'vitest';

import { simulateRuns, uniqueVariantCount } from './sample-variance';

describe('sample-variance', () => {
  it('returns one variant at temperature 0', () => {
    const runs = simulateRuns(0, 8, 99);
    expect(uniqueVariantCount(runs)).toBe(1);
    expect(runs.every((run) => run.variantId === 'canonical')).toBe(true);
  });

  it('produces more variety at higher temperature', () => {
    const cold = uniqueVariantCount(simulateRuns(0, 12, 7));
    const hot = uniqueVariantCount(simulateRuns(0.9, 12, 7));
    expect(hot).toBeGreaterThan(cold);
  });

  it('is deterministic for the same seed', () => {
    const a = simulateRuns(0.5, 5, 123);
    const b = simulateRuns(0.5, 5, 123);
    expect(a).toEqual(b);
  });
});
