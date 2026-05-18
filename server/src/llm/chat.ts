import { LogEvents } from '../logging/events.js';
import { logEvent, logPromptSnippet } from '../logging/logger.js';
import { completeWithRetry, type CompleteContext } from './rate-limit.js';
import { JSON_RETRY_SYSTEM } from './prompts.js';
import { parseJsonText } from './parse-json.js';
import type { ChatMessage, LlmProvider } from './types.js';

export async function chat(
  provider: LlmProvider,
  model: string,
  messages: ChatMessage[],
  context: CompleteContext & { json?: boolean },
): Promise<string> {
  const userContent = messages.find((m) => m.role === 'user')?.content ?? '';

  logEvent('debug', LogEvents.llmRequest, {
    ...context,
    provider: provider.name,
    model,
    promptLength: userContent.length,
  });

  if (context.runId && context.evaluationId) {
    logPromptSnippet(context.runId, context.evaluationId, 'user', userContent);
  }

  return completeWithRetry(
    () => provider.complete(model, messages, { json: context.json }),
    { ...context, provider: provider.name, model },
  );
}

export async function chatJson<T>(
  provider: LlmProvider,
  model: string,
  messages: ChatMessage[],
  context: CompleteContext,
  parse: (raw: unknown) => T,
): Promise<T> {
  try {
    const text = await chat(provider, model, messages, { ...context, json: true });
    return parse(parseJsonText<unknown>(text));
  } catch (firstError) {
    logEvent('warn', LogEvents.llmRetry, {
      ...context,
      provider: provider.name,
      model,
      attempt: 1,
      message: firstError instanceof Error ? firstError.message : 'JSON parse failed',
    });

    const retryMessages: ChatMessage[] = [
      { role: 'system', content: JSON_RETRY_SYSTEM },
      ...messages.filter((m) => m.role !== 'system'),
    ];
    const text = await chat(provider, model, retryMessages, { ...context, json: true });
    return parse(parseJsonText<unknown>(text));
  }
}
