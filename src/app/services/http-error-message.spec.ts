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

  it('maps 401 to an API token / Settings hint', () => {
    expect(messageFromHttpError({ status: 401, error: { message: 'Unauthorized' } }, 'Fallback')).toBe(
      'Unauthorized. Add or update your API token in Settings.',
    );
    expect(messageFromHttpError({ status: 401 }, 'Fallback')).toBe(
      'Unauthorized. Add or update your API token in Settings.',
    );
    expect(
      messageFromHttpError({ status: 401, error: { message: 'Token expired' } }, 'Fallback'),
    ).toBe('Token expired. Add or update your API token in Settings.');
  });
});
