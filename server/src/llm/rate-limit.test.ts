import { afterEach, describe, expect, it, vi } from 'vitest';

import { LlmHttpError } from './llm-http-error.js';
import {
  completeWithRetry,
  extractRateLimitWaitMs,
  isRateLimitError,
  MAX_RATE_LIMIT_WAIT_MS,
  resolveRateLimitWaitMs,
} from './rate-limit.js';

vi.mock('../config.js', () => ({
  config: {
    llmInterCallDelayMs: 0,
    llmMaxRetries: 2,
    llmBackoffBaseMs: 500,
  },
}));

vi.mock('../logging/logger.js', () => ({
  logEvent: vi.fn(),
}));

describe('isRateLimitError', () => {
  it('detects LlmHttpError 429 and message 429', () => {
    expect(isRateLimitError(new LlmHttpError('limited', 429, 1000))).toBe(true);
    expect(isRateLimitError(new Error('LLM request failed: 429 — rate limited'))).toBe(true);
    expect(isRateLimitError(new LlmHttpError('not found', 404))).toBe(false);
    expect(isRateLimitError(new Error('boom'))).toBe(false);
  });
});

describe('extractRateLimitWaitMs / resolveRateLimitWaitMs', () => {
  it('reads retryAfterMs from LlmHttpError', () => {
    expect(extractRateLimitWaitMs(new LlmHttpError('x', 429, 3758))).toBe(3758);
  });

  it('parses try-again text from plain Error messages', () => {
    expect(
      extractRateLimitWaitMs(
        new Error('LLM request failed: 429 — Please try again in 3.7575s.'),
      ),
    ).toBe(3758);
  });

  it('uses max of exponential backoff and provider hint', () => {
    const error = new LlmHttpError('x', 429, 3758);
    expect(resolveRateLimitWaitMs(error, 500)).toBe(3758);
    expect(resolveRateLimitWaitMs(error, 8000)).toBe(8000);
  });

  it('falls back to exponential backoff when no hint', () => {
    expect(resolveRateLimitWaitMs(new Error('429'), 500)).toBe(500);
  });

  it('caps waits at MAX_RATE_LIMIT_WAIT_MS', () => {
    const error = new LlmHttpError('x', 429, 120_000);
    expect(resolveRateLimitWaitMs(error, 500)).toBe(MAX_RATE_LIMIT_WAIT_MS);
  });
});

describe('completeWithRetry', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('waits the provider-hinted duration before retrying', async () => {
    vi.useFakeTimers();

    const fn = vi
      .fn()
      .mockRejectedValueOnce(
        new LlmHttpError(
          'LLM request failed: 429 — Please try again in 3.7575s.',
          429,
          3758,
        ),
      )
      .mockResolvedValueOnce({ text: 'ok' });

    const resultPromise = completeWithRetry(fn, {});

    await vi.advanceTimersByTimeAsync(3757);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(resultPromise).resolves.toEqual({ text: 'ok' });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('aborts while waiting for the rate-limit delay', async () => {
    vi.useFakeTimers();

    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new LlmHttpError('429', 429, 5000));

    const resultPromise = completeWithRetry(fn, { abortSignal: controller.signal });

    // Flush inter-call delay + first attempt so the rate-limit wait is armed.
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    controller.abort(new Error('Automation cancelled.'));
    await expect(resultPromise).rejects.toThrow('Automation cancelled.');
  });
});
