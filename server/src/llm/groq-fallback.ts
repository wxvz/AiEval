import type { ResolvedLlmSetup } from './types.js';

export function isSlowRequestError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === 'TimeoutError' || error.name === 'AbortError';
}

export function resolveGroqModelForCall(
  currentSetup: ResolvedLlmSetup,
  groqSetup: ResolvedLlmSetup,
  model: string,
): string {
  const answerIndex = currentSetup.answerModels.findIndex((entry) => entry.model === model);

  if (answerIndex >= 0) {
    return groqSetup.answerModels[answerIndex]?.model ?? groqSetup.answerModels[0]!.model;
  }

  if (currentSetup.judgeModel.model === model) {
    return groqSetup.judgeModel.model;
  }

  return groqSetup.judgeModel.model;
}
