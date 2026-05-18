import { describe, expect, it } from 'vitest';

import { jsonToSentences } from './json-to-sentences.js';

describe('jsonToSentences', () => {
  it('returns plain strings unchanged', () => {
    expect(jsonToSentences('Clear answer.')).toBe('Clear answer.');
  });

  it('flattens nested objects into sentences', () => {
    expect(
      jsonToSentences({
        strengths: ['accurate', 'concise'],
        weaknesses: { tone: 'too formal' },
      }),
    ).toContain('strengths: accurate concise.');
  });

  it('parses JSON strings', () => {
    expect(jsonToSentences('{"finalAnswer":"Done"}')).toBe('final Answer: Done.');
  });
});
