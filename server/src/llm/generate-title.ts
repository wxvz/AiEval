import { chatWithModelFallback, type ModelFallbackHandlers } from '../automation/resilient-llm.js';
import { chat } from './chat.js';
import { buildTitleGenerateUser, TITLE_GENERATE_SYSTEM } from './prompts.js';
import { resolveProvider } from './provider.js';
import type { CompleteContext } from './rate-limit.js';
import { stripModelArtifacts } from './sanitize-model-output.js';
import type { ResolvedLlmSetup } from './types.js';

const MIN_TITLE_LENGTH = 3;
/** Higher than scoring/generation defaults so repeated title runs do not collapse to one phrase. */
export const TITLE_GENERATION_TEMPERATURE = 0.85;

export interface MetadataGenerationOptions {
  setup: ResolvedLlmSetup;
  handlers: ModelFallbackHandlers;
}

export async function generateEvaluationTitle(
  extraContext: Partial<CompleteContext> = {},
  options?: MetadataGenerationOptions,
): Promise<string> {
  const setup = options?.setup ?? (await resolveProvider());
  const messages = [
    { role: 'system' as const, content: TITLE_GENERATE_SYSTEM },
    { role: 'user' as const, content: buildTitleGenerateUser() },
  ];
  const context: CompleteContext = {
    step: 'generating',
    provider: setup.providerName,
    model: setup.judgeModel.model,
    temperature: TITLE_GENERATION_TEMPERATURE,
    ...extraContext,
  };

  const completion = options
    ? await chatWithModelFallback(setup, 'judge', 0, options.handlers, messages, context)
    : await chat(setup.provider, setup.judgeModel.model, messages, context);

  const title = stripModelArtifacts(completion.text).trim();

  if (title.length < MIN_TITLE_LENGTH) {
    throw new Error('Generated title was too short. Try again.');
  }

  return title;
}
