import { describe, expect, it } from 'vitest';

import { TEACHING_CORPUS } from './corpus';

describe('corpus', () => {
  it('has unique ids and consistent 2D vectors', () => {
    const ids = new Set<string>();
    for (const chunk of TEACHING_CORPUS) {
      expect(ids.has(chunk.id)).toBe(false);
      ids.add(chunk.id);
      expect(chunk.vector).toHaveLength(2);
      expect(Number.isFinite(chunk.vector[0])).toBe(true);
      expect(Number.isFinite(chunk.vector[1])).toBe(true);
      expect(chunk.text.trim().length).toBeGreaterThan(0);
    }
  });
});
