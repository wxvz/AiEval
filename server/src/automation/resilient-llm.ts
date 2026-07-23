import { chat } from '../llm/chat.js';
import { resolveProviderModelForCall } from '../llm/groq-fallback.js';
import {
  isFallbackEligibleHttpStatus,
  parseLlmHttpStatusFromError,
} from '../llm/llm-http-error.js';
import { modelIdToLabel, resolveSingleModel, type ModelRole } from '../llm/model-presets.js';
import { createLlmProvider, isProviderAvailable, PROVIDER_ORDER } from '../llm/provider.js';
import { isRateLimitError, type CompleteContext } from '../llm/rate-limit.js';
import type { ChatMessage, LlmCompletion, LlmProvider, ProviderName, ResolvedLlmSetup } from '../llm/types.js';
import { LogEvents } from '../logging/events.js';
import { logEvent } from '../logging/logger.js';
import { getLlmPreset } from '../runtime-settings.js';
import type { Answer, RubricCriterion } from '../types/evaluation.js';
import { isAutomationCancelled } from './run-registry.js';

function classifyFallbackRejectReason(error: unknown): string {
  if (isRateLimitError(error)) {
    return 'rate_limit';
  }

  if (!(error instanceof Error)) {
    return 'failed';
  }

  const message = error.message.toLowerCase();

  if (message.includes('unusable model')) {
    return 'unusable_model';
  }

  if (message.includes('sanitized empty') || message.includes('has empty content')) {
    return 'empty_content';
  }

  return 'failed';
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isJsonParseFailure(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error instanceof SyntaxError) {
    return true;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes('json') ||
    message.includes('unexpected end of json') ||
    message.includes('unexpected token')
  );
}

export interface FallbackCandidate {
  providerName: ProviderName;
  model: string;
  label: string;
}

export interface ModelFallbackHandlers {
  onModelFallback?: (
    fromModel: string,
    toModel: string,
    slotIndex?: number,
    reason?: string,
  ) => void;
}

function candidateKey(candidate: FallbackCandidate): string {
  return `${candidate.providerName}:${candidate.model}`;
}

/** Errors where the next fallback candidate may succeed (rate limits, transient network). */
export function isFallbackEligible(error: unknown): boolean {
  if (isRateLimitError(error)) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const status = parseLlmHttpStatusFromError(error);

  if (status !== undefined && isFallbackEligibleHttpStatus(status)) {
    return true;
  }

  if (isJsonParseFailure(error)) {
    return true;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes('fetch failed') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('socket hang up') ||
    // Thinking-model strip left no scorable text — try the next candidate.
    // Match classifyFallbackRejectReason / generate empty-content throws.
    message.includes('sanitized empty') ||
    message.includes('has empty content')
  );
}

function pushCandidate(
  candidates: FallbackCandidate[],
  seen: Set<string>,
  providerName: ProviderName,
  model: string,
): void {
  const key = `${providerName}:${model}`;

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  candidates.push({
    providerName,
    model,
    label: modelIdToLabel(model),
  });
}

function isAnswerSlotModel(model: string, setup: ResolvedLlmSetup): boolean {
  return setup.answerModels.some((ref) => ref.model === model);
}

/** True when `model` is configured on a different answer slot than `slotIndex`. */
function isSiblingAnswerSlotModel(
  model: string,
  setup: ResolvedLlmSetup,
  slotIndex: number,
): boolean {
  return setup.answerModels.some((ref, index) => index !== slotIndex && ref.model === model);
}

function pushJudgeCandidate(
  candidates: FallbackCandidate[],
  seen: Set<string>,
  setup: ResolvedLlmSetup,
  model: string,
): void {
  if (isAnswerSlotModel(model, setup)) {
    return;
  }

  pushCandidate(candidates, seen, setup.providerName, model);
}

function pushAnswerCandidate(
  candidates: FallbackCandidate[],
  seen: Set<string>,
  setup: ResolvedLlmSetup,
  slotIndex: number,
  providerName: ProviderName,
  model: string,
): void {
  if (isSiblingAnswerSlotModel(model, setup, slotIndex)) {
    return;
  }

  pushCandidate(candidates, seen, providerName, model);
}

function minimalSetupForMapping(
  baseSetup: ResolvedLlmSetup,
  targetProvider: ProviderName,
  preset: 'balanced' | 'fast',
): ResolvedLlmSetup {
  const answerModels = baseSetup.answerModels.map((ref, index) => {
    const model = resolveSingleModel(targetProvider, 'answer', index, preset);

    return { model, label: modelIdToLabel(model) };
  });
  const judgeModel = resolveSingleModel(targetProvider, 'judge', 0, preset);

  return {
    providerName: targetProvider,
    provider: createLlmProvider(targetProvider),
    answerModels,
    judgeModel: { model: judgeModel, label: modelIdToLabel(judgeModel) },
    preset: baseSetup.preset,
  };
}

export async function buildFallbackCandidates(
  baseSetup: ResolvedLlmSetup,
  role: ModelRole,
  slotIndex: number,
  signal?: AbortSignal,
): Promise<FallbackCandidate[]> {
  const candidates: FallbackCandidate[] = [];
  const seen = new Set<string>();
  // Freeze to setup.preset so mid-run overlay changes cannot reshuffle fallback chains.
  const activePreset = baseSetup.preset;
  const livePreset = getLlmPreset();

  if (livePreset !== activePreset) {
    logEvent('debug', LogEvents.llmPresetMismatch, {
      message: 'Live LLM preset differs from frozen setup preset; using setup.preset for fallbacks',
      preset: activePreset,
      livePreset,
    });
  }

  if (role === 'answer') {
    const ref = baseSetup.answerModels[slotIndex];

    if (ref) {
      pushAnswerCandidate(
        candidates,
        seen,
        baseSetup,
        slotIndex,
        baseSetup.providerName,
        ref.model,
      );
    }

    const fastModel = resolveSingleModel(baseSetup.providerName, 'answer', slotIndex, 'fast');

    if (fastModel !== ref?.model) {
      pushAnswerCandidate(
        candidates,
        seen,
        baseSetup,
        slotIndex,
        baseSetup.providerName,
        fastModel,
      );
    }

    const referenceModel = ref?.model ?? fastModel;
    const startIndex = PROVIDER_ORDER.indexOf(baseSetup.providerName) + 1;

    for (let i = startIndex; i < PROVIDER_ORDER.length; i += 1) {
      if (signal && isAutomationCancelled(signal)) {
        throw new Error('Automation cancelled.');
      }

      const providerName = PROVIDER_ORDER[i]!;

      if (!(await isProviderAvailable(providerName))) {
        continue;
      }

      const targetSetup = minimalSetupForMapping(baseSetup, providerName, activePreset);
      const mapped = resolveProviderModelForCall(baseSetup, targetSetup, referenceModel);
      pushAnswerCandidate(candidates, seen, targetSetup, slotIndex, providerName, mapped);
    }
  } else {
    pushJudgeCandidate(candidates, seen, baseSetup, baseSetup.judgeModel.model);

    const fastJudge = resolveSingleModel(baseSetup.providerName, 'judge', 0, 'fast');

    if (fastJudge !== baseSetup.judgeModel.model) {
      pushJudgeCandidate(candidates, seen, baseSetup, fastJudge);
    }

    const referenceModel = baseSetup.judgeModel.model;
    const startIndex = PROVIDER_ORDER.indexOf(baseSetup.providerName) + 1;

    for (let i = startIndex; i < PROVIDER_ORDER.length; i += 1) {
      if (signal && isAutomationCancelled(signal)) {
        throw new Error('Automation cancelled.');
      }

      const providerName = PROVIDER_ORDER[i]!;

      if (!(await isProviderAvailable(providerName))) {
        continue;
      }

      const targetSetup = minimalSetupForMapping(baseSetup, providerName, activePreset);
      const mapped = resolveProviderModelForCall(baseSetup, targetSetup, referenceModel);
      pushJudgeCandidate(candidates, seen, targetSetup, mapped);
    }

    if (candidates.length === 0) {
      throw new Error(
        'No eligible judge fallback candidates. Judge models must not overlap answer-slot models, and at least one provider with a distinct judge model must be available.',
      );
    }
  }

  return candidates;
}

export async function callSingleModelWithFallback<T>(
  candidates: readonly FallbackCandidate[],
  handlers: ModelFallbackHandlers,
  slotIndex: number | undefined,
  invoke: (provider: LlmProvider, model: string, candidate: FallbackCandidate) => Promise<T>,
  skipKeys?: ReadonlySet<string>,
  signal?: AbortSignal,
): Promise<T> {
  const providers = new Map<ProviderName, LlmProvider>();
  let lastError: unknown;
  let fromModel = candidates[0]?.model ?? '';
  let attemptedFirst = false;
  let skippedPrior: string | undefined;
  let lastRejectReason: string | undefined;

  for (const candidate of candidates) {
    if (signal && isAutomationCancelled(signal)) {
      throw new Error('Automation cancelled.');
    }

    const key = candidateKey(candidate);

    if (skipKeys?.has(key)) {
      skippedPrior = skippedPrior ?? candidate.model;
      continue;
    }

    if (attemptedFirst) {
      handlers.onModelFallback?.(fromModel, candidate.model, slotIndex, lastRejectReason);
    } else if (skippedPrior) {
      // Primary slot already failed earlier — announce the hop to the next candidate.
      handlers.onModelFallback?.(skippedPrior, candidate.model, slotIndex, lastRejectReason);
    }

    attemptedFirst = true;

    let provider = providers.get(candidate.providerName);

    if (!provider) {
      provider = createLlmProvider(candidate.providerName);
      providers.set(candidate.providerName, provider);
    }

    try {
      return await invoke(provider, candidate.model, candidate);
    } catch (error) {
      if (signal && (isAutomationCancelled(signal) || (isAbortError(error) && signal.aborted))) {
        throw new Error('Automation cancelled.');
      }

      lastError = error;

      if (!isFallbackEligible(error)) {
        throw error;
      }

      lastRejectReason = classifyFallbackRejectReason(error);

      logEvent('warn', LogEvents.automationAnswerRejected, {
        provider: candidate.providerName,
        model: candidate.model,
        reason: lastRejectReason,
        detail: error instanceof Error ? error.message : String(error),
        ...(slotIndex !== undefined ? { slotIndex } : {}),
      });

      fromModel = candidate.model;
    }
  }

  if (lastError instanceof Error) {
    if (signal && (isAutomationCancelled(signal) || (isAbortError(lastError) && signal.aborted))) {
      throw new Error('Automation cancelled.');
    }

    throw lastError;
  }

  throw new Error('All model fallback candidates were exhausted or skipped.');
}

export async function chatWithModelFallback(
  setup: ResolvedLlmSetup,
  role: ModelRole,
  slotIndex: number,
  handlers: ModelFallbackHandlers,
  messages: ChatMessage[],
  context: CompleteContext,
): Promise<LlmCompletion> {
  const candidates = await buildFallbackCandidates(setup, role, slotIndex, context.abortSignal);

  return callSingleModelWithFallback(
    candidates,
    handlers,
    slotIndex,
    (provider, model) =>
      chat(provider, model, messages, {
        ...context,
        provider: provider.name,
        model,
      }),
    undefined,
    context.abortSignal,
  );
}

export function validateAnswersForScoring(
  answers: Answer[],
  criteria: RubricCriterion[],
  expectedCount: number,
): void {
  if (answers.length === 0 || answers.length > expectedCount) {
    throw new Error(`Expected 1–${expectedCount} answers, got ${answers.length}.`);
  }

  const ids = new Set<string>();

  for (const answer of answers) {
    if (!answer.content.trim()) {
      throw new Error(`Answer ${answer.label} has empty content.`);
    }

    if (answer.scores.length !== criteria.length) {
      throw new Error(`Answer ${answer.label} has invalid score placeholders.`);
    }

    if (ids.has(answer.id)) {
      throw new Error('Duplicate answer ids in checkpoint.');
    }

    ids.add(answer.id);

    if (answer.isWinner) {
      throw new Error('Partial generate checkpoint must not include a winner.');
    }
  }
}

export function validateScoredAnswers(answers: Answer[], criteria: RubricCriterion[]): void {
  for (const answer of answers) {
    if (!answer.content.trim()) {
      throw new Error(`Answer ${answer.label} has empty content.`);
    }

    if (answer.scores.length !== criteria.length) {
      throw new Error(`Answer ${answer.label} is missing rubric scores.`);
    }

    const hasPoints = answer.scores.every(
      (score) => typeof score.points === 'number' && Number.isFinite(score.points),
    );

    if (!hasPoints) {
      throw new Error(`Answer ${answer.label} has incomplete scores.`);
    }
  }
}

export function mapAnswersToSlots(answers: Answer[], setup: ResolvedLlmSetup): (Answer | null)[] {
  const slots: (Answer | null)[] = Array.from({ length: setup.answerModels.length }, () => null);
  const usedSlots = new Set<number>();
  const remaining: Answer[] = [];

  for (const answer of answers) {
    // Empty/unusable leftovers from a prior run must stay pending so fallback can regenerate.
    if (!answer.content.trim()) {
      continue;
    }

    if (
      typeof answer.slotIndex === 'number' &&
      answer.slotIndex >= 0 &&
      answer.slotIndex < slots.length &&
      slots[answer.slotIndex] === null
    ) {
      slots[answer.slotIndex] = answer;
      usedSlots.add(answer.slotIndex);
    } else {
      remaining.push(answer);
    }
  }

  const dropped: Answer[] = [];

  for (const answer of remaining) {
    let slotIndex = setup.answerModels.findIndex(
      (modelRef, index) => !usedSlots.has(index) && modelRef.label === answer.label,
    );

    if (slotIndex < 0) {
      slotIndex = slots.findIndex((slot) => slot === null);
    }

    if (slotIndex >= 0 && slotIndex < slots.length && slots[slotIndex] === null) {
      slots[slotIndex] = answer;
      usedSlots.add(slotIndex);
    } else {
      dropped.push(answer);
    }
  }

  if (dropped.length > 0) {
    logEvent('warn', LogEvents.automationAnswerRejected, {
      message: `mapAnswersToSlots dropped ${dropped.length} answer(s) with no free slot`,
      droppedAnswerIds: dropped.map((answer) => answer.id),
      droppedLabels: dropped.map((answer) => answer.label),
      slotCount: slots.length,
      inputCount: answers.length,
    });
  }

  return slots;
}

export function pendingSlotIndices(slots: (Answer | null)[]): number[] {
  return slots.flatMap((slot, index) => (slot === null ? [index] : []));
}

export function answersFromSlots(slots: (Answer | null)[]): Answer[] {
  return slots.filter((slot): slot is Answer => slot !== null);
}
