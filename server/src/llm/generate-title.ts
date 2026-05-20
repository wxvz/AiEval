import { chat } from './chat.js';
import { buildTitleGenerateUser, TITLE_GENERATE_SYSTEM } from './prompts.js';
import { resolveProvider } from './provider.js';
import { stripModelArtifacts } from './sanitize-model-output.js';
import type { CompleteContext } from './rate-limit.js';

const MIN_TITLE_LENGTH = 3;
/** Higher than scoring/generation defaults so repeated title runs do not collapse to one phrase. */
export const TITLE_GENERATION_TEMPERATURE = 0.85;

export async function generateEvaluationTitle(
  extraContext: Partial<CompleteContext> = {},
): Promise<string> {
  const setup = await resolveProvider();
  const completion = await chat(
    setup.provider,
    setup.judgeModel.model,
    [
      { role: 'system', content: TITLE_GENERATE_SYSTEM },
      { role: 'user', content: buildTitleGenerateUser() },
    ],
    {
      step: 'generating',
      provider: setup.providerName,
      model: setup.judgeModel.model,
      temperature: TITLE_GENERATION_TEMPERATURE,
      ...extraContext,
    },
  );

  const title = stripModelArtifacts(completion.text).trim();

  if (title.length < MIN_TITLE_LENGTH) {
    throw new Error('Generated title was too short. Try again.');
  }

  return title;
}
