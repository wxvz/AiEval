import { clearProviderChoice } from './provider-choice.js';

interface ActiveRun {
  runId: string;
  abortController: AbortController;
}

const activeByEvaluationId = new Map<string, ActiveRun>();

export function registerAutomationRun(evaluationId: string, runId: string): AbortSignal {
  const existing = activeByEvaluationId.get(evaluationId);

  if (existing) {
    existing.abortController.abort();
    clearProviderChoice(evaluationId);
  }

  const abortController = new AbortController();
  activeByEvaluationId.set(evaluationId, { runId, abortController });
  return abortController.signal;
}

export function cancelAutomationRun(evaluationId: string, runId: string): boolean {
  const active = activeByEvaluationId.get(evaluationId);

  if (!active) {
    return false;
  }

  if (!runId || active.runId !== runId) {
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
}

export function isAutomationCancelled(signal: AbortSignal): boolean {
  return signal.aborted;
}
