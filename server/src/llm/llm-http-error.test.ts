import { describe, expect, it } from 'vitest';

import {
  isFallbackEligibleHttpStatus,
  parseLlmHttpStatusFromError,
  readLlmErrorMessage,
  throwLlmHttpError,
} from './llm-http-error.js';

function mockResponse(status: number, body: string): Response {
  return new Response(body, { status });
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
});

describe('parseLlmHttpStatusFromError', () => {
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
