import { config } from '../config.js';

interface PendingProviderChoice {
  runId: string;
  promise: Promise<boolean>;
  resolve: (useCloud: boolean) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  abortCleanup?: () => void;
}

/**
 * Process-local only — not shared across server instances or restarts.
 * After a restart, resume POST returns 404 (pending map is empty).
 */
const pendingByEvaluationId = new Map<string, PendingProviderChoice>();

/** How long the server waits for the user to answer the slow-provider prompt. */
export const CHOICE_TIMEOUT_MS = 30 * 60 * 1000;

export type SubmitProviderChoiceResult =
  | { ok: true }
  | { ok: false; reason: 'not_pending' | 'run_mismatch' };

function cleanupPending(pending: PendingProviderChoice): void {
  clearTimeout(pending.timer);
  pending.abortCleanup?.();
}

export function waitForProviderChoice(
  evaluationId: string,
  runId: string,
  abortSignal?: AbortSignal,
): Promise<boolean> {
  if (abortSignal?.aborted) {
    return Promise.reject(new Error('Automation cancelled.'));
  }

  const existing = pendingByEvaluationId.get(evaluationId);

  if (existing?.runId === runId) {
    return existing.promise;
  }

  if (existing) {
    // Same status as registry supersede / cancel — keep UI cancelled vs failed consistent.
    existing.reject(new Error('Automation cancelled.'));
    cleanupPending(existing);
    pendingByEvaluationId.delete(evaluationId);
  }

  let resolve!: (useCloud: boolean) => void;
  let reject!: (error: Error) => void;

  const promise = new Promise<boolean>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const timer = setTimeout(() => {
    const pending = pendingByEvaluationId.get(evaluationId);

    if (!pending || pending.runId !== runId) {
      return;
    }

    pendingByEvaluationId.delete(evaluationId);
    pending.abortCleanup?.();
    reject(new Error('Provider choice timed out.'));
  }, CHOICE_TIMEOUT_MS);

  let abortCleanup: (() => void) | undefined;

  if (abortSignal) {
    const onAbort = () => {
      rejectProviderChoice(evaluationId, new Error('Automation cancelled.'));
    };

    abortSignal.addEventListener('abort', onAbort);
    abortCleanup = () => abortSignal.removeEventListener('abort', onAbort);
  }

  pendingByEvaluationId.set(evaluationId, {
    runId,
    promise,
    resolve,
    reject,
    timer,
    abortCleanup,
  });

  return promise;
}

export function submitProviderChoice(
  evaluationId: string,
  runId: string,
  useCloud: boolean,
): SubmitProviderChoiceResult {
  const pending = pendingByEvaluationId.get(evaluationId);

  if (!pending) {
    return { ok: false, reason: 'not_pending' };
  }

  if (!runId || pending.runId !== runId) {
    return { ok: false, reason: 'run_mismatch' };
  }

  cleanupPending(pending);
  pendingByEvaluationId.delete(evaluationId);
  pending.resolve(useCloud);
  return { ok: true };
}

export function rejectProviderChoice(evaluationId: string, error: Error): void {
  const pending = pendingByEvaluationId.get(evaluationId);

  if (!pending) {
    return;
  }

  cleanupPending(pending);
  pendingByEvaluationId.delete(evaluationId);
  pending.reject(error);
}

export function clearProviderChoice(evaluationId: string): void {
  rejectProviderChoice(evaluationId, new Error('Automation cancelled.'));
}

/** Label for how long local inference ran before the slow-provider prompt. */
export function providerChoiceTimeoutLabel(): string {
  const minutes = Math.round(config.llmSlowFallbackMs / 60_000);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/** Label for how long the user has to answer the provider-choice prompt. */
export function providerChoiceWaitTimeoutLabel(): string {
  const minutes = Math.round(CHOICE_TIMEOUT_MS / 60_000);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}
