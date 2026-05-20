import { generateEvaluationPrompt } from '../llm/generate-prompt.js';
import { generateEvaluationTitle } from '../llm/generate-title.js';
import type { CompleteContext } from '../llm/rate-limit.js';

export interface EvaluationMetadata {
  title: string;
  prompt: string;
}

/** Generate title and prompt for full automation when the evaluation still has stub metadata. */
export async function generateEvaluationMetadata(
  extraContext: Partial<CompleteContext> = {},
): Promise<EvaluationMetadata> {
  const title = await generateEvaluationTitle(extraContext);
  const prompt = await generateEvaluationPrompt(title, extraContext);

  return { title, prompt };
}
