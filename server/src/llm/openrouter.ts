import { config } from '../config.js';
import { llmFetch } from './llm-fetch.js';
import type { ChatMessage, LlmProvider } from './types.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

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
        throw new Error(`OpenRouter request failed: ${response.status}`);
      }

      const body = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };

      return body.choices?.[0]?.message?.content?.trim() ?? '';
    },
  };
}

export function hasOpenRouterCredentials(): boolean {
  return config.openRouterApiKey.length > 0;
}
