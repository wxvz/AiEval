import { config } from '../config.js';
import { LogEvents } from '../logging/events.js';
import { logEvent } from '../logging/logger.js';
import { LlmHttpError, parseTryAgainInMs } from './llm-http-error.js';
import type { LlmCompletion, LlmTokenUsage, ResolvedLlmSetup } from './types.js';

/** Cap on provider-hinted waits so a huge Retry-After cannot stall automation. */
export const MAX_RATE_LIMIT_WAIT_MS = 60_000;

let lastCallAt = 0;
let interCallDelayMutex: Promise<void> = Promise.resolve();

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  if (signal?.aborted) {
    return Promise.reject(signal.reason ?? new Error('Aborted'));
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error('Aborted'));
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function waitInterCallDelay(signal?: AbortSignal): Promise<void> {
  const run = async (): Promise<void> => {
    const elapsed = Math.max(0, Date.now() - lastCallAt);
    const wait = config.llmInterCallDelayMs - elapsed;

    if (wait > 0) {
      await delay(wait, signal);
    }

    lastCallAt = Date.now();
  };

  const slot = interCallDelayMutex.then(run, run);
  interCallDelayMutex = slot.catch(() => {});
  await slot;
}

export function isRateLimitError(error: unknown): boolean {
  if (error instanceof LlmHttpError && error.status === 429) {
    return true;
  }

  if (error instanceof Error && error.message.includes('429')) {
    return true;
  }

  return false;
}

/** True when per-call retries are exhausted and the error is still a rate limit. */
export function isRateLimitExhausted(error: unknown): boolean {
  return isRateLimitError(error);
}

/** Provider-supplied wait from Retry-After / "try again in Xs", when present. */
export function extractRateLimitWaitMs(error: unknown): number | undefined {
  if (error instanceof LlmHttpError && typeof error.retryAfterMs === 'number') {
    return error.retryAfterMs;
  }

  if (error instanceof Error) {
    return parseTryAgainInMs(error.message);
  }

  return undefined;
}

/**
 * Wait before a rate-limit retry: max(exponential backoff, provider hint), capped.
 */
export function resolveRateLimitWaitMs(
  error: unknown,
  exponentialBackoffMs: number,
  maxWaitMs = MAX_RATE_LIMIT_WAIT_MS,
): number {
  const hinted = extractRateLimitWaitMs(error);
  const wait = Math.max(exponentialBackoffMs, hinted ?? 0);
  return Math.min(Math.max(0, wait), maxWaitMs);
}

export interface CompleteContext {
  runId?: string;
  evaluationId?: string;
  provider?: string;
  model?: string;
  step?: string;
  currentSetup?: ResolvedLlmSetup;
  skipSlowFallback?: boolean;
  requestProviderChoice?: (prompt: {
    currentProvider: string;
    cloudProvider: string | null;
  }) => Promise<boolean>;
  onCloudProviderSwitch?: (cloudSetup: ResolvedLlmSetup) => void;
  onPreferLocalProvider?: () => void;
  abortSignal?: AbortSignal;
  recordUsage?: (usage: LlmTokenUsage) => void;
}

export async function completeWithRetry(
  fn: () => Promise<LlmCompletion>,
  context: CompleteContext,
): Promise<LlmCompletion> {
  let attempt = 0;

  while (true) {
    await waitInterCallDelay(context.abortSignal);

    try {
      return await fn();
    } catch (error) {
      if (isRateLimitError(error) && attempt < config.llmMaxRetries) {
        const backoff = config.llmBackoffBaseMs * 2 ** attempt;
        const hintedWaitMs = extractRateLimitWaitMs(error);
        const waitMs = resolveRateLimitWaitMs(error, backoff);
        logEvent('warn', LogEvents.llmRateLimit, {
          ...context,
          attempt: attempt + 1,
          backoffMs: backoff,
          waitMs,
          ...(hintedWaitMs !== undefined ? { hintedWaitMs } : {}),
        });
        await delay(waitMs, context.abortSignal);
        attempt += 1;
        logEvent('warn', LogEvents.llmRetry, {
          ...context,
          attempt,
          message: error instanceof Error ? error.message : 'Rate limited',
        });
        continue;
      }

      logEvent('error', LogEvents.llmCallFailed, {
        ...context,
        attempt: attempt + 1,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
