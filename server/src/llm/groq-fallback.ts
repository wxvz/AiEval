import type { ResolvedLlmSetup } from './types.js';

export function isSlowRequestError(error: unknown, userAbortSignal?: AbortSignal): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  // User cancel shares AbortError with slow-request timeouts — never treat cancel as slow.
  if (userAbortSignal?.aborted) {
    return false;
  }

  return error.name === 'TimeoutError' || error.name === 'AbortError';
}

export function resolveProviderModelForCall(
  currentSetup: ResolvedLlmSetup,
  targetSetup: ResolvedLlmSetup,
  model: string,
): string {
  const answerIndex = currentSetup.answerModels.findIndex((entry) => entry.model === model);

  if (answerIndex >= 0) {
    return targetSetup.answerModels[answerIndex]?.model ?? targetSetup.answerModels[0]!.model;
  }

  if (currentSetup.judgeModel.model === model) {
    return targetSetup.judgeModel.model;
  }

  return targetSetup.judgeModel.model;
}

/** @deprecated Use resolveProviderModelForCall */
export const resolveGroqModelForCall = resolveProviderModelForCall;
