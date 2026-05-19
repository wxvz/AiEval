import { config } from '../config.js';
import { LogEvents } from '../logging/events.js';
import { logEvent, logPromptSnippet } from '../logging/logger.js';
import { isSlowRequestError, resolveProviderModelForCall } from './groq-fallback.js';
import { completeWithRetry, type CompleteContext } from './rate-limit.js';
import { JSON_RETRY_SYSTEM } from './prompts.js';
import { parseJsonText } from './parse-json.js';
import { resolveFirstCloudProvider } from './provider.js';
import type { ChatMessage, LlmCompletion, LlmProvider } from './types.js';

function mergeSignals(...signals: (AbortSignal | undefined)[]): AbortSignal | undefined {
  const active = signals.filter((signal): signal is AbortSignal => !!signal);

  if (active.length === 0) {
    return undefined;
  }

  if (active.length === 1) {
    return active[0];
  }

  return AbortSignal.any(active);
}

export async function chat(
  provider: LlmProvider,
  model: string,
  messages: ChatMessage[],
  context: CompleteContext & { json?: boolean; temperature?: number },
): Promise<LlmCompletion> {
  const userContent = messages.find((m) => m.role === 'user')?.content ?? '';

  logEvent('info', LogEvents.llmRequest, {
    ...context,
    provider: provider.name,
    model,
    promptLength: userContent.length,
  });

  if (context.runId && context.evaluationId) {
    logPromptSnippet(context.runId, context.evaluationId, 'user', userContent);
  }

  const slowSignal =
    provider.name === 'ollama' && !context.skipSlowFallback
      ? AbortSignal.timeout(config.llmSlowFallbackMs)
      : undefined;
  const requestSignal = mergeSignals(context.abortSignal, slowSignal);

  try {
    return await completeWithRetry(
      async () =>
        provider.complete(model, messages, {
          json: context.json,
          signal: requestSignal,
          temperature: context.temperature,
        }),
      { ...context, provider: provider.name, model },
    );
  } catch (error) {
    if (
      !isSlowRequestError(error) ||
      provider.name !== 'ollama' ||
      context.skipSlowFallback ||
      !context.currentSetup ||
      !context.requestProviderChoice
    ) {
      throw error;
    }

    const cloudSetup = await resolveFirstCloudProvider();
    const useCloud = await context.requestProviderChoice({
      currentProvider: provider.name,
      cloudProvider: cloudSetup?.providerName ?? null,
    });

    if (useCloud) {
      if (!cloudSetup) {
        throw new Error(
          'No cloud LLM provider configured. Set GROQ_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY, or HUGGINGFACE_API_KEY.',
        );
      }

      const cloudModel = resolveProviderModelForCall(context.currentSetup, cloudSetup, model);

      logEvent('warn', LogEvents.llmSlowFallback, {
        ...context,
        from: provider.name,
        to: cloudSetup.providerName,
        model,
        cloudModel,
        durationMs: config.llmSlowFallbackMs,
        message: 'User chose cloud provider after slow local response',
      });

      context.onCloudProviderSwitch?.(cloudSetup);

      return completeWithRetry(
        async () =>
          cloudSetup.provider.complete(cloudModel, messages, {
            json: context.json,
            signal: mergeSignals(context.abortSignal),
            temperature: context.temperature,
          }),
        { ...context, provider: cloudSetup.providerName, model: cloudModel },
      );
    }

    logEvent('info', LogEvents.llmSlowFallback, {
      ...context,
      from: provider.name,
      message: 'User chose to continue with local provider',
    });

    context.onPreferLocalProvider?.();

    return completeWithRetry(
      async () =>
        provider.complete(model, messages, {
          json: context.json,
          signal: mergeSignals(context.abortSignal),
          temperature: context.temperature,
        }),
      { ...context, provider: provider.name, model },
    );
  }
}

export async function chatJson<T>(
  provider: LlmProvider,
  model: string,
  messages: ChatMessage[],
  context: CompleteContext,
  parse: (raw: unknown) => T,
): Promise<T> {
  try {
    const completion = await chat(provider, model, messages, { ...context, json: true });
    return parse(parseJsonText<unknown>(completion.text));
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
    const completion = await chat(provider, model, retryMessages, { ...context, json: true });
    return parse(parseJsonText<unknown>(completion.text));
  }
}
