import { config } from '../config.js';
import { llmFetch } from './llm-fetch.js';
import {
  DEFAULT_LLM_TEMPERATURE,
  type ChatMessage,
  type LlmCompletion,
  type LlmProvider,
} from './types.js';

function toGeminiContents(messages: ChatMessage[]): {
  systemInstruction?: { parts: { text: string }[] };
  contents: { role: string; parts: { text: string }[] }[];
} {
  const system = messages.find((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');

  return {
    ...(system
      ? { systemInstruction: { parts: [{ text: system.content }] } }
      : {}),
    contents: nonSystem.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  };
}

export function createGeminiProvider(): LlmProvider {
  return {
    name: 'gemini',
    async complete(model, messages, options) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const { systemInstruction, contents } = toGeminiContents(messages);

      const response = await llmFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.geminiApiKey,
        },
        signal: options?.signal,
        body: JSON.stringify({
          ...(systemInstruction ? { systemInstruction } : {}),
          contents,
          generationConfig: {
            temperature: options?.temperature ?? DEFAULT_LLM_TEMPERATURE,
            ...(options?.json ? { responseMimeType: 'application/json' } : {}),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini request failed: ${response.status}`);
      }

      const body = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };

      return { text: body.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '' };
    },
  };
}

export function hasGeminiCredentials(): boolean {
  return config.geminiApiKey.length > 0;
}
