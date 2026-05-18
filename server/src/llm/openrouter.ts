import { config } from '../config.js';
import { throwLlmHttpError } from './llm-http-error.js';
import { llmFetch } from './llm-fetch.js';
import type { ChatMessage, LlmCompletion, LlmProvider } from './types.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface OpenRouterChatResponse {
  model?: string;
  choices?: { message?: { content?: string } }[];
}

export function createOpenRouterProvider(): LlmProvider {
  return {
    name: 'openrouter',
    async complete(model, messages, options) {
      const response = await llmFetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openRouterApiKey}`,
          'HTTP-Referer': config.openRouterHttpReferer,
          'X-Title': config.openRouterAppTitle,
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
        await throwLlmHttpError('OpenRouter request failed', response);
      }

      const body = (await response.json()) as OpenRouterChatResponse;
      const text = body.choices?.[0]?.message?.content?.trim() ?? '';
      const resolvedModel =
        typeof body.model === 'string' && body.model.length > 0 && body.model !== model
          ? body.model
          : undefined;

      return { text, ...(resolvedModel ? { resolvedModel } : {}) };
    },
  };
}

export function hasOpenRouterCredentials(): boolean {
  return config.openRouterApiKey.length > 0;
}
