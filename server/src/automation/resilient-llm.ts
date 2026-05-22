import { getLlmPreset } from '../runtime-settings.js';
import { resolveProviderModelForCall } from '../llm/groq-fallback.js';
import { modelIdToLabel, resolveSingleModel, type ModelRole } from '../llm/model-presets.js';
import { createLlmProvider, isProviderAvailable, PROVIDER_ORDER } from '../llm/provider.js';
import { isRateLimitError } from '../llm/rate-limit.js';
import type { LlmProvider, ProviderName, ResolvedLlmSetup } from '../llm/types.js';
import type { Answer, RubricCriterion } from '../types/evaluation.js';

export interface FallbackCandidate {
  providerName: ProviderName;
  model: string;
  label: string;
}

export interface ModelFallbackHandlers {
  onModelFallback?: (fromModel: string, toModel: string, slotIndex?: number) => void;
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

  const message = error.message.toLowerCase();

  return (
    message.includes('fetch failed') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('socket hang up')
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
  };
}

export async function buildFallbackCandidates(
  baseSetup: ResolvedLlmSetup,
  role: ModelRole,
  slotIndex: number,
): Promise<FallbackCandidate[]> {
  const candidates: FallbackCandidate[] = [];
  const seen = new Set<string>();
  const activePreset = getLlmPreset();

  if (role === 'answer') {
    const ref = baseSetup.answerModels[slotIndex];

    if (ref) {
      pushCandidate(candidates, seen, baseSetup.providerName, ref.model);
    }

    const fastModel = resolveSingleModel(baseSetup.providerName, 'answer', slotIndex, 'fast');

    if (fastModel !== ref?.model) {
      pushCandidate(candidates, seen, baseSetup.providerName, fastModel);
    }

    const referenceModel = ref?.model ?? fastModel;
    const startIndex = PROVIDER_ORDER.indexOf(baseSetup.providerName) + 1;

    for (let i = startIndex; i < PROVIDER_ORDER.length; i += 1) {
      const providerName = PROVIDER_ORDER[i]!;

      if (!(await isProviderAvailable(providerName))) {
        continue;
      }

      const targetSetup = minimalSetupForMapping(baseSetup, providerName, activePreset);
      const mapped = resolveProviderModelForCall(baseSetup, targetSetup, referenceModel);
      pushCandidate(candidates, seen, providerName, mapped);
    }
  } else {
    pushCandidate(candidates, seen, baseSetup.providerName, baseSetup.judgeModel.model);

    const fastJudge = resolveSingleModel(baseSetup.providerName, 'judge', 0, 'fast');

    if (fastJudge !== baseSetup.judgeModel.model) {
      pushCandidate(candidates, seen, baseSetup.providerName, fastJudge);
    }

    const referenceModel = baseSetup.judgeModel.model;
    const startIndex = PROVIDER_ORDER.indexOf(baseSetup.providerName) + 1;

    for (let i = startIndex; i < PROVIDER_ORDER.length; i += 1) {
      const providerName = PROVIDER_ORDER[i]!;

      if (!(await isProviderAvailable(providerName))) {
        continue;
      }

      const targetSetup = minimalSetupForMapping(baseSetup, providerName, activePreset);
      const mapped = resolveProviderModelForCall(baseSetup, targetSetup, referenceModel);
      pushCandidate(candidates, seen, providerName, mapped);
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
): Promise<T> {
  const providers = new Map<ProviderName, LlmProvider>();
  let lastError: unknown;
  let fromModel = candidates[0]?.model ?? '';
  let attemptedFirst = false;

  for (const candidate of candidates) {
    const key = candidateKey(candidate);

    if (skipKeys?.has(key)) {
      continue;
    }

    if (attemptedFirst) {
      handlers.onModelFallback?.(fromModel, candidate.model, slotIndex);
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
      lastError = error;

      if (!isFallbackEligible(error)) {
        throw error;
      }

      fromModel = candidate.model;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error('All model fallback candidates were exhausted or skipped.');
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

  for (const answer of answers) {
    let slotIndex = setup.answerModels.findIndex(
      (modelRef, index) => !usedSlots.has(index) && modelRef.label === answer.label,
    );

    if (slotIndex < 0) {
      slotIndex = slots.findIndex((slot) => slot === null);
    }

    if (slotIndex >= 0 && slotIndex < slots.length && slots[slotIndex] === null) {
      slots[slotIndex] = answer;
      usedSlots.add(slotIndex);
    }
  }

  return slots;
}

export function pendingSlotIndices(slots: (Answer | null)[]): number[] {
  return slots.flatMap((slot, index) => (slot === null ? [index] : []));
}

export function answersFromSlots(slots: (Answer | null)[]): Answer[] {
  return slots.filter((slot): slot is Answer => slot !== null);
}
