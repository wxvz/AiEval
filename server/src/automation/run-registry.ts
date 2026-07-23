import { clearProviderChoice } from './provider-choice.js';

interface ActiveRun {
  runId: string;
  abortController: AbortController;
}

const activeByEvaluationId = new Map<string, ActiveRun>();

/** Cancels recorded before registerAutomationRun (race between SSE runId and registry). */
const pendingCancelsByEvaluationId = new Map<string, Map<string, number>>();

/** Drop pending cancels that never matched a register (orphan POST cancel / abandoned SSE). */
export const PENDING_CANCEL_TTL_MS = 2 * 60 * 1000;

function prunePendingCancels(evaluationId: string, now = Date.now()): Map<string, number> | undefined {
  const pending = pendingCancelsByEvaluationId.get(evaluationId);

  if (!pending) {
    return undefined;
  }

  for (const [runId, recordedAt] of pending) {
    if (now - recordedAt > PENDING_CANCEL_TTL_MS) {
      pending.delete(runId);
    }
  }

  if (pending.size === 0) {
    pendingCancelsByEvaluationId.delete(evaluationId);
    return undefined;
  }

  return pending;
}

export function registerAutomationRun(evaluationId: string, runId: string): AbortSignal {
  const existing = activeByEvaluationId.get(evaluationId);

  if (existing) {
    existing.abortController.abort();
    clearProviderChoice(evaluationId);
  }

  const abortController = new AbortController();
  activeByEvaluationId.set(evaluationId, { runId, abortController });

  const pending = prunePendingCancels(evaluationId);

  if (pending?.delete(runId)) {
    abortController.abort();

    if (pending.size === 0) {
      pendingCancelsByEvaluationId.delete(evaluationId);
    }
  }

  return abortController.signal;
}

export function cancelAutomationRun(evaluationId: string, runId: string): boolean {
  if (!runId) {
    return false;
  }

  const active = activeByEvaluationId.get(evaluationId);

  if (!active) {
    let pending = prunePendingCancels(evaluationId);

    if (!pending) {
      pending = new Map();
      pendingCancelsByEvaluationId.set(evaluationId, pending);
    }

    pending.set(runId, Date.now());
    return true;
  }

  if (active.runId !== runId) {
    return false;
  }

  active.abortController.abort();
  clearProviderChoice(evaluationId);
  return true;
}

export function clearAutomationRun(evaluationId: string, runId: string): void {
  const active = activeByEvaluationId.get(evaluationId);

  if (active?.runId === runId) {
    activeByEvaluationId.delete(evaluationId);
  }

  // Drop orphan pending cancels for a finished run (late EventSource close after success).
  const pending = pendingCancelsByEvaluationId.get(evaluationId);

  if (pending?.delete(runId) && pending.size === 0) {
    pendingCancelsByEvaluationId.delete(evaluationId);
  }
}

export function ownsAutomationRun(evaluationId: string, runId: string): boolean {
  const active = activeByEvaluationId.get(evaluationId);
  return active?.runId === runId;
}

/** Active run id for an evaluation, if any (used to repair stomped doc claims). */
export function getActiveAutomationRunId(evaluationId: string): string | undefined {
  return activeByEvaluationId.get(evaluationId)?.runId;
}

/** True when any evaluation has an in-flight automation run (local single-user guard). */
export function hasAnyActiveAutomationRun(): boolean {
  return activeByEvaluationId.size > 0;
}

export function isAutomationCancelled(signal: AbortSignal): boolean {
  return signal.aborted;
}

/** Abort every active automation and drop pending cancels (process shutdown). */
export function cancelAllActiveAutomations(): number {
  let count = 0;

  for (const [evaluationId, active] of activeByEvaluationId) {
    active.abortController.abort();
    clearProviderChoice(evaluationId);
    count += 1;
  }

  activeByEvaluationId.clear();
  pendingCancelsByEvaluationId.clear();
  return count;
}

/** Test helper: whether a pending cancel is still recorded for runId. */
export function hasPendingCancel(evaluationId: string, runId: string): boolean {
  const pending = prunePendingCancels(evaluationId);
  return pending?.has(runId) ?? false;
}
