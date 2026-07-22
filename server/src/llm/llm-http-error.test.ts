import { describe, expect, it } from 'vitest';

import {
  isFallbackEligibleHttpStatus,
  LlmHttpError,
  parseLlmHttpStatusFromError,
  parseRetryAfterHeader,
  parseTryAgainInMs,
  readLlmErrorMessage,
  throwLlmHttpError,
} from './llm-http-error.js';

function mockResponse(
  status: number,
  body: string,
  headers?: Record<string, string>,
): Response {
  return new Response(body, { status, headers });
}

describe('readLlmErrorMessage', () => {
  it('extracts OpenAI-style error.message', async () => {
    const response = mockResponse(
      400,
      JSON.stringify({
        error: {
          message: 'The model `gemma2-9b-it` has been decommissioned.',
          type: 'invalid_request_error',
        },
      }),
    );

    await expect(readLlmErrorMessage(response)).resolves.toBe(
      'The model `gemma2-9b-it` has been decommissioned.',
    );
  });

  it('falls back to status when body is empty', async () => {
    const response = mockResponse(502, '');

    await expect(readLlmErrorMessage(response)).resolves.toBe('HTTP 502');
  });
});

describe('parseRetryAfterHeader', () => {
  it('parses delta-seconds', () => {
    expect(parseRetryAfterHeader('4')).toBe(4000);
    expect(parseRetryAfterHeader('3.7575')).toBe(3758);
  });

  it('parses HTTP-date relative to now', () => {
    // HTTP-date is second-resolution; aim ~5s ahead so truncation still leaves headroom.
    const when = new Date(Date.now() + 5_000).toUTCString();
    const ms = parseRetryAfterHeader(when);
    expect(ms).toBeGreaterThanOrEqual(3_500);
    expect(ms).toBeLessThanOrEqual(5_500);
  });

  it('returns undefined for empty or invalid values', () => {
    expect(parseRetryAfterHeader(null)).toBeUndefined();
    expect(parseRetryAfterHeader('')).toBeUndefined();
    expect(parseRetryAfterHeader('not-a-date')).toBeUndefined();
  });
});

describe('parseTryAgainInMs', () => {
  it('parses Groq TPM wait text', () => {
    expect(
      parseTryAgainInMs(
        'Rate limit reached for model `openai/gpt-oss-120b`. Please try again in 3.7575s. Need more tokens?',
      ),
    ).toBe(3758);
  });

  it('returns undefined when no wait is present', () => {
    expect(parseTryAgainInMs('Rate limit reached')).toBeUndefined();
  });
});

describe('throwLlmHttpError', () => {
  it('includes status and provider message', async () => {
    const response = mockResponse(
      404,
      JSON.stringify({
        error: { message: 'The model `llama-3.2-3b` does not exist.' },
      }),
    );

    await expect(throwLlmHttpError('LLM request failed', response)).rejects.toThrow(
      'LLM request failed: 404 — The model `llama-3.2-3b` does not exist.',
    );
  });

  it('attaches Retry-After header as retryAfterMs', async () => {
    const response = mockResponse(
      429,
      JSON.stringify({ error: { message: 'Rate limited' } }),
      { 'Retry-After': '4' },
    );

    try {
      await throwLlmHttpError('LLM request failed', response);
      expect.fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(LlmHttpError);
      expect((error as LlmHttpError).status).toBe(429);
      expect((error as LlmHttpError).retryAfterMs).toBe(4000);
    }
  });

  it('falls back to body try-again text when header is missing', async () => {
    const response = mockResponse(
      429,
      JSON.stringify({
        error: {
          message:
            'Rate limit reached for model `openai/gpt-oss-120b`. Please try again in 3.7575s.',
        },
      }),
    );

    try {
      await throwLlmHttpError('LLM request failed', response);
      expect.fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(LlmHttpError);
      expect((error as LlmHttpError).retryAfterMs).toBe(3758);
    }
  });
});

describe('parseLlmHttpStatusFromError', () => {
  it('reads status from LlmHttpError', () => {
    expect(parseLlmHttpStatusFromError(new LlmHttpError('x', 429, 1000))).toBe(429);
  });

  it('parses Groq/OpenRouter em-dash format', () => {
    expect(
      parseLlmHttpStatusFromError(
        new Error('OpenRouter request failed: 404 — Provider returned error'),
      ),
    ).toBe(404);
  });

  it('parses simple request failed format', () => {
    expect(parseLlmHttpStatusFromError(new Error('Gemini request failed: 502'))).toBe(502);
    expect(parseLlmHttpStatusFromError(new Error('Hugging Face request failed: 503'))).toBe(503);
  });

  it('returns undefined when no status is present', () => {
    expect(parseLlmHttpStatusFromError(new Error('Unexpected end of JSON input'))).toBeUndefined();
  });
});

describe('isFallbackEligibleHttpStatus', () => {
  it('treats routing and transient server errors as eligible', () => {
    expect(isFallbackEligibleHttpStatus(404)).toBe(true);
    expect(isFallbackEligibleHttpStatus(502)).toBe(true);
    expect(isFallbackEligibleHttpStatus(503)).toBe(true);
  });

  it('does not treat auth or client errors as eligible', () => {
    expect(isFallbackEligibleHttpStatus(400)).toBe(false);
    expect(isFallbackEligibleHttpStatus(401)).toBe(false);
    expect(isFallbackEligibleHttpStatus(403)).toBe(false);
  });
});
