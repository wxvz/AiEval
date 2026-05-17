import { describe, expect, it } from 'vitest';

import { messageFromHttpError } from './http-error-message';

describe('messageFromHttpError', () => {
  it('returns the server message when present', () => {
    const error = { error: { message: 'title and prompt are required' } };

    expect(messageFromHttpError(error, 'Fallback')).toBe('title and prompt are required');
  });

  it('returns the fallback when message is missing or empty', () => {
    expect(messageFromHttpError({ error: {} }, 'Fallback')).toBe('Fallback');
    expect(messageFromHttpError({ error: { message: '   ' } }, 'Fallback')).toBe('Fallback');
    expect(messageFromHttpError(null, 'Fallback')).toBe('Fallback');
  });
});
