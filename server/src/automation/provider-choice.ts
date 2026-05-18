import { config } from '../config.js';

interface PendingProviderChoice {
  runId: string;
  resolve: (useCloud: boolean) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingByEvaluationId = new Map<string, PendingProviderChoice>();

const CHOICE_TIMEOUT_MS = 30 * 60 * 1000;

export function waitForProviderChoice(evaluationId: string, runId: string): Promise<boolean> {
  const existing = pendingByEvaluationId.get(evaluationId);

  if (existing) {
    existing.reject(new Error('Provider choice superseded.'));
    clearTimeout(existing.timer);
    pendingByEvaluationId.delete(evaluationId);
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingByEvaluationId.delete(evaluationId);
      reject(new Error('Provider choice timed out.'));
    }, CHOICE_TIMEOUT_MS);

    pendingByEvaluationId.set(evaluationId, {
      runId,
      resolve,
      reject,
      timer,
    });
  });
}

export function submitProviderChoice(
  evaluationId: string,
  runId: string | undefined,
  useCloud: boolean,
): boolean {
  const pending = pendingByEvaluationId.get(evaluationId);

  if (!pending) {
    return false;
  }

  if (runId && pending.runId !== runId) {
    return false;
  }

  clearTimeout(pending.timer);
  pendingByEvaluationId.delete(evaluationId);
  pending.resolve(useCloud);
  return true;
}

export function rejectProviderChoice(evaluationId: string, error: Error): void {
  const pending = pendingByEvaluationId.get(evaluationId);

  if (!pending) {
    return;
  }

  clearTimeout(pending.timer);
  pendingByEvaluationId.delete(evaluationId);
  pending.reject(error);
}

export function clearProviderChoice(evaluationId: string): void {
  rejectProviderChoice(
    evaluationId,
    new Error('Automation cancelled.'),
  );
}

export function providerChoiceTimeoutLabel(): string {
  const minutes = Math.round(config.llmSlowFallbackMs / 60_000);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}
