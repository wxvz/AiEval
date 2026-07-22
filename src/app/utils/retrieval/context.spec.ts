import { describe, expect, it } from 'vitest';

import { assembleContext, estimateTokens } from './context';

describe('context', () => {
  it('estimates tokens from character count', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('a'.repeat(8))).toBe(2);
  });

  it('assembles context within maxChars preserving order', () => {
    const assembled = assembleContext(
      [{ text: 'First chunk.' }, { text: 'Second chunk with more text.' }],
      30,
    );
    expect(assembled).toContain('First chunk.');
    expect(assembled.length).toBeLessThanOrEqual(30);
  });

  it('returns empty string for zero budget', () => {
    expect(assembleContext([{ text: 'Hello' }], 0)).toBe('');
  });
});
