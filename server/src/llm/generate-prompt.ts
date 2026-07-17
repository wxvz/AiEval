import { chatWithModelFallback } from '../automation/resilient-llm.js';
import { chat } from './chat.js';
import type { MetadataGenerationOptions } from './generate-title.js';
import { buildPromptGenerateSystem, buildPromptGenerateUser } from './prompts.js';
import { resolveProvider } from './provider.js';
import type { CompleteContext } from './rate-limit.js';
import { stripModelArtifacts } from './sanitize-model-output.js';
import { DEFAULT_EVALUATION_CONFIG } from '../evaluation-config.js';
import type { EvaluationConfig } from '../types/evaluation.js';

const MIN_PROMPT_LENGTH = 10;

export async function generateEvaluationPrompt(
  title: string,
  extraContext: Partial<CompleteContext> = {},
  options?: MetadataGenerationOptions,
  evaluationConfig: EvaluationConfig = DEFAULT_EVALUATION_CONFIG,
): Promise<string> {
  const setup = options?.setup ?? (await resolveProvider());
  const messages = [
    { role: 'system' as const, content: buildPromptGenerateSystem(evaluationConfig) },
    { role: 'user' as const, content: buildPromptGenerateUser(title, evaluationConfig) },
  ];
  const context: CompleteContext = {
    step: 'generating',
    provider: setup.providerName,
    model: setup.judgeModel.model,
    ...extraContext,
  };

  const completion = options
    ? await chatWithModelFallback(setup, 'judge', 0, options.handlers, messages, context)
    : await chat(setup.provider, setup.judgeModel.model, messages, context);

  const prompt = stripModelArtifacts(completion.text).trim();

  if (prompt.length < MIN_PROMPT_LENGTH) {
    throw new Error('Generated prompt was too short. Try again or edit the title.');
  }

  return prompt;
}
