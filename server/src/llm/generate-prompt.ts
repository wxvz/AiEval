import { chat } from './chat.js';
import { buildPromptGenerateUser, PROMPT_GENERATE_SYSTEM } from './prompts.js';
import { resolveProvider } from './provider.js';
import { stripModelArtifacts } from './sanitize-model-output.js';

const MIN_PROMPT_LENGTH = 10;

export async function generateEvaluationPrompt(title: string): Promise<string> {
  const setup = await resolveProvider();
  const completion = await chat(
    setup.provider,
    setup.judgeModel.model,
    [
      { role: 'system', content: PROMPT_GENERATE_SYSTEM },
      { role: 'user', content: buildPromptGenerateUser(title) },
    ],
    { step: 'generating', provider: setup.providerName, model: setup.judgeModel.model },
  );

  const prompt = stripModelArtifacts(completion.text).trim();

  if (prompt.length < MIN_PROMPT_LENGTH) {
    throw new Error('Generated prompt was too short. Try again or edit the title.');
  }

  return prompt;
}
