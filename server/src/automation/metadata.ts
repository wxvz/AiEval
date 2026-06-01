import { generateEvaluationPrompt } from '../llm/generate-prompt.js';
import { generateEvaluationTitle } from '../llm/generate-title.js';
import type { CompleteContext } from '../llm/rate-limit.js';
import type { ResolvedLlmSetup } from '../llm/types.js';
import type { ModelFallbackHandlers } from './resilient-llm.js';

export interface EvaluationMetadata {
  title: string;
  prompt: string;
}

/** Generate title and prompt for full automation when the evaluation still has stub metadata. */
export async function generateEvaluationMetadata(
  setup: ResolvedLlmSetup,
  handlers: ModelFallbackHandlers,
  extraContext: Partial<CompleteContext> = {},
): Promise<EvaluationMetadata> {
  const options = { setup, handlers };
  const title = await generateEvaluationTitle(extraContext, options);
  const prompt = await generateEvaluationPrompt(title, extraContext, options);

  return { title, prompt };
}
