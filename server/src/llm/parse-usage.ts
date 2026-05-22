import type { ChatMessage, LlmTokenUsage } from './types.js';

const CHARS_PER_TOKEN_ESTIMATE = 4;

function messageChars(messages: ChatMessage[]): number {
  return messages.reduce((sum, message) => sum + message.content.length, 0);
}

export function estimateUsage(messages: ChatMessage[], completionText: string): LlmTokenUsage {
  const promptTokens = Math.ceil(messageChars(messages) / CHARS_PER_TOKEN_ESTIMATE);
  const completionTokens = Math.ceil(completionText.length / CHARS_PER_TOKEN_ESTIMATE);

  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimated: true,
  };
}

export function parseOpenAiCompatibleUsage(body: unknown): LlmTokenUsage | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const usage = (body as { usage?: unknown }).usage;

  if (!usage || typeof usage !== 'object') {
    return undefined;
  }

  const promptTokens = (usage as { prompt_tokens?: unknown }).prompt_tokens;
  const completionTokens = (usage as { completion_tokens?: unknown }).completion_tokens;
  const totalTokens = (usage as { total_tokens?: unknown }).total_tokens;

  if (
    typeof promptTokens !== 'number' ||
    typeof completionTokens !== 'number' ||
    typeof totalTokens !== 'number'
  ) {
    return undefined;
  }

  return { promptTokens, completionTokens, totalTokens };
}

export function parseGeminiUsage(body: unknown): LlmTokenUsage | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const metadata = (body as { usageMetadata?: unknown }).usageMetadata;

  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }

  const promptTokens = (metadata as { promptTokenCount?: unknown }).promptTokenCount;
  const completionTokens = (metadata as { candidatesTokenCount?: unknown }).candidatesTokenCount;
  const totalTokens = (metadata as { totalTokenCount?: unknown }).totalTokenCount;

  if (
    typeof promptTokens !== 'number' ||
    typeof completionTokens !== 'number' ||
    typeof totalTokens !== 'number'
  ) {
    return undefined;
  }

  return { promptTokens, completionTokens, totalTokens };
}

export function parseOllamaUsage(body: unknown): LlmTokenUsage | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const promptTokens = (body as { prompt_eval_count?: unknown }).prompt_eval_count;
  const completionTokens = (body as { eval_count?: unknown }).eval_count;

  if (typeof promptTokens !== 'number' || typeof completionTokens !== 'number') {
    return undefined;
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}
