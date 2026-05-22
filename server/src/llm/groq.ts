import { config } from '../config.js';
import { throwLlmHttpError } from './llm-http-error.js';
import { llmFetch } from './llm-fetch.js';
import { parseOpenAiCompatibleUsage } from './parse-usage.js';
import {
  DEFAULT_LLM_TEMPERATURE,
  type ChatMessage,
  type LlmCompleteOptions,
  type LlmCompletion,
  type LlmProvider,
} from './types.js';

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
      temperature: options?.temperature ?? DEFAULT_LLM_TEMPERATURE,
      ...(options?.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok) {
    await throwLlmHttpError('LLM request failed', response);
  }

  const body = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  const text = body.choices?.[0]?.message?.content?.trim() ?? '';
  const usage = parseOpenAiCompatibleUsage(body);

  return { text, ...(usage ? { usage } : {}) };
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
