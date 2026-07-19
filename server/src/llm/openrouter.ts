import { config } from '../config.js';
import { LogEvents } from '../logging/events.js';
import { logEvent } from '../logging/logger.js';
import { throwLlmHttpError } from './llm-http-error.js';
import { llmFetch } from './llm-fetch.js';
import { parseOpenAiCompatibleUsage } from './parse-usage.js';
import {
  isSafetyClassifierOutput,
  isUnusableAnswerModel,
} from './sanitize-model-output.js';
import {
  DEFAULT_LLM_TEMPERATURE,
  type ChatMessage,
  type LlmCompleteOptions,
  type LlmCompletion,
  type LlmProvider,
} from './types.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** When `openrouter/free` routes to a guardrail model, retry with a chat-capable free model. */
const OPENROUTER_FREE_CHAT_FALLBACK = 'meta-llama/llama-3.2-3b-instruct:free';

interface OpenRouterChatResponse {
  model?: string;
  choices?: { message?: { content?: string } }[];
}

async function openRouterCompleteOnce(
  model: string,
  messages: ChatMessage[],
  options?: LlmCompleteOptions,
): Promise<LlmCompletion> {
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
      temperature: options?.temperature ?? DEFAULT_LLM_TEMPERATURE,
      ...(options?.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok) {
    await throwLlmHttpError('OpenRouter request failed', response);
  }

  const body = (await response.json()) as OpenRouterChatResponse;
  const text = body.choices?.[0]?.message?.content?.trim() ?? '';
  const usage = parseOpenAiCompatibleUsage(body);
  const resolvedModel =
    typeof body.model === 'string' && body.model.length > 0 && body.model !== model
      ? body.model
      : undefined;

  return {
    text,
    ...(usage ? { usage } : {}),
    ...(resolvedModel ? { resolvedModel } : {}),
  };
}

function needsOpenRouterFreeChatRetry(
  requestedModel: string,
  completion: LlmCompletion,
): boolean {
  if (requestedModel !== 'openrouter/free') {
    return false;
  }

  const routed = completion.resolvedModel ?? requestedModel;

  return isUnusableAnswerModel(routed) || isSafetyClassifierOutput(completion.text);
}

export function createOpenRouterProvider(): LlmProvider {
  return {
    name: 'openrouter',
    async complete(model, messages, options) {
      const first = await openRouterCompleteOnce(model, messages, options);

      if (!needsOpenRouterFreeChatRetry(model, first)) {
        return first;
      }

      const routed = first.resolvedModel ?? model;
      logEvent('warn', LogEvents.automationModelFallback, {
        step: 'provider',
        fromModel: routed,
        toModel: OPENROUTER_FREE_CHAT_FALLBACK,
        reason: isUnusableAnswerModel(routed) ? 'unusable_model' : 'empty_content',
      });

      const retry = await openRouterCompleteOnce(
        OPENROUTER_FREE_CHAT_FALLBACK,
        messages,
        options,
      );

      return {
        ...retry,
        resolvedModel: retry.resolvedModel ?? OPENROUTER_FREE_CHAT_FALLBACK,
      };
    },
  };
}

export function hasOpenRouterCredentials(): boolean {
  return config.openRouterApiKey.length > 0;
}
