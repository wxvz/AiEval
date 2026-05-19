import { describe, expect, it } from 'vitest';

import { readLlmErrorMessage, throwLlmHttpError } from './llm-http-error.js';

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
