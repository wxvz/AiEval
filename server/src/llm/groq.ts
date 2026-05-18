import { config } from '../config.js';
import { throwLlmHttpError } from './llm-http-error.js';
import { llmFetch } from './llm-fetch.js';
import type { ChatMessage, LlmCompleteOptions, LlmCompletion, LlmProvider } from './types.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function openAiCompatibleComplete(
  url: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  options?: LlmCompleteOptions,
): Promise<LlmCompletion> {
  const response = await llmFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal: options?.signal,
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      ...(options?.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok) {
    await throwLlmHttpError('LLM request failed', response);
  }

  const body = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  return { text: body.choices?.[0]?.message?.content?.trim() ?? '' };
}

export function createGroqProvider(): LlmProvider {
  return {
    name: 'groq',
    complete(model, messages, options) {
      return openAiCompatibleComplete(GROQ_URL, config.groqApiKey, model, messages, options);
    },
  };
}

export function hasGroqCredentials(): boolean {
  return config.groqApiKey.length > 0;
}
