import { config } from '../config.js';
import { llmFetch } from './llm-fetch.js';
import type { ChatMessage, LlmProvider } from './types.js';

function toPrompt(messages: ChatMessage[]): string {
  return messages
    .map((m) => `${m.role === 'system' ? 'System' : m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
}

export function createHuggingFaceProvider(): LlmProvider {
  return {
    name: 'huggingface',
    async complete(model, messages, options) {
      const response = await llmFetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.huggingFaceApiKey}`,
        },
        signal: options?.signal,
        body: JSON.stringify({
          inputs: toPrompt(messages),
          parameters: { max_new_tokens: 1024, return_full_text: false },
        }),
      });

      if (!response.ok) {
        throw new Error(`Hugging Face request failed: ${response.status}`);
      }

      const body = (await response.json()) as
        | { generated_text?: string }[]
        | { generated_text?: string };

      if (Array.isArray(body)) {
        return { text: body[0]?.generated_text?.trim() ?? '' };
      }

      return { text: body.generated_text?.trim() ?? '' };
    },
  };
}

export function hasHuggingFaceCredentials(): boolean {
  return config.huggingFaceApiKey.length > 0;
}
