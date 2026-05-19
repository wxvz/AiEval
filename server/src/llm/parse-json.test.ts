import { describe, expect, it } from 'vitest';

import { parseJsonText, stripJsonFences } from './parse-json.js';

describe('parse-json', () => {
  it('strips markdown fences', () => {
    expect(stripJsonFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('parses fenced JSON', () => {
    expect(parseJsonText<{ a: number }>('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });
});
