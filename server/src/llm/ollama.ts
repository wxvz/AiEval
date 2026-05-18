import { config } from '../config.js';
import { llmFetch } from './llm-fetch.js';
import type { ChatMessage, LlmProvider } from './types.js';

export function createOllamaProvider(): LlmProvider {
  return {
    name: 'ollama',
    async complete(model, messages, options) {
      const response = await llmFetch(`${config.ollamaBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: options?.signal,
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          ...(options?.json ? { format: 'json' } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.status}`);
      }

      const body = (await response.json()) as { message?: { content?: string } };
      return { text: body.message?.content?.trim() ?? '' };
    },
  };
}

export async function isOllamaHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${config.ollamaBaseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
