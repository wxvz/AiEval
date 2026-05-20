import { describe, expect, it } from 'vitest';

import { createTokenAccumulator } from './token-accumulator.js';

describe('createTokenAccumulator', () => {
  it('starts empty', () => {
    expect(createTokenAccumulator().totals()).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
  });

  it('adds to initial totals and tracks estimated flag', () => {
    const accumulator = createTokenAccumulator({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });

    accumulator.add({ promptTokens: 3, completionTokens: 7, totalTokens: 10 });
    accumulator.add({
      promptTokens: 1,
      completionTokens: 1,
      totalTokens: 2,
      estimated: true,
    });

    expect(accumulator.totals()).toEqual({
      promptTokens: 14,
      completionTokens: 13,
      totalTokens: 27,
      estimated: true,
    });
  });
});
