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

/** Models that expose Groq reasoning controls (see https://console.groq.com/docs/reasoning). */
function isGroqReasoningModel(model: string): boolean {
  const id = model.toLowerCase();
  return (
    id.includes('qwen3.6') ||
    id.includes('gpt-oss') ||
    id.includes('minimax')
  );
}

/**
 * Keep reasoning off the stored answer text. Default/raw formats can put
 * chain-of-thought (or truncated verification dumps) into message.content.
 */
function groqReasoningRequestFields(model: string): Record<string, string> {
  if (!isGroqReasoningModel(model)) {
    return {};
  }

  return { reasoning_format: 'hidden' };
}

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
      ...groqReasoningRequestFields(model),
    }),
  });

  if (!response.ok) {
    await throwLlmHttpError('LLM request failed', response);
  }

  const body = (await response.json()) as {
    choices?: { message?: { content?: string; reasoning?: string } }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  // Never surface message.reasoning — evaluation stores the final answer only.
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

export { groqReasoningRequestFields, isGroqReasoningModel };
