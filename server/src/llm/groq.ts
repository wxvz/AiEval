import { config } from '../config.js';
import type { ChatMessage, LlmProvider } from './types.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function openAiCompatibleComplete(
  url: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  options?: { json?: boolean },
): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      ...(options?.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM request failed: ${response.status}`);
  }

  const body = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  return body.choices?.[0]?.message?.content?.trim() ?? '';
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
