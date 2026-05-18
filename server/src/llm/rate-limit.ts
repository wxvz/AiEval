import { config } from '../config.js';
import { LogEvents } from '../logging/events.js';
import { logEvent } from '../logging/logger.js';
import type { ResolvedLlmSetup } from './types.js';

let lastCallAt = 0;
let interCallDelayMutex: Promise<void> = Promise.resolve();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitInterCallDelay(): Promise<void> {
  const run = async (): Promise<void> => {
    const elapsed = Date.now() - lastCallAt;
    const wait = config.llmInterCallDelayMs - elapsed;

    if (wait > 0) {
      await delay(wait);
    }

    lastCallAt = Date.now();
  };

  const slot = interCallDelayMutex.then(run, run);
  interCallDelayMutex = slot.catch(() => {});
  await slot;
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error && error.message.includes('429')) {
    return true;
  }

  return false;
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
}

export async function completeWithRetry(
  fn: () => Promise<string>,
  context: CompleteContext,
): Promise<string> {
  let attempt = 0;

  while (true) {
    await waitInterCallDelay();

    try {
      const start = Date.now();
      const result = await fn();
      logEvent('info', LogEvents.llmResponse, {
        ...context,
        durationMs: Date.now() - start,
        outputLength: result.length,
      });
      return result;
    } catch (error) {
      if (isRateLimitError(error) && attempt < config.llmMaxRetries) {
        const backoff = config.llmBackoffBaseMs * 2 ** attempt;
        logEvent('warn', LogEvents.llmRateLimit, {
          ...context,
          attempt: attempt + 1,
          backoffMs: backoff,
        });
        await delay(backoff);
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
