import { generateEvaluationPrompt } from '../llm/generate-prompt.js';
import { generateEvaluationTitle } from '../llm/generate-title.js';

export interface EvaluationMetadata {
  title: string;
  prompt: string;
}

/** Generate title and prompt for full automation when the evaluation still has stub metadata. */
export async function generateEvaluationMetadata(): Promise<EvaluationMetadata> {
  const title = await generateEvaluationTitle();
  const prompt = await generateEvaluationPrompt(title);

  return { title, prompt };
}
