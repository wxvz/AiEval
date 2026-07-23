import { ObjectId } from 'mongodb';

import { config } from '../config.js';
import { getLlmPreset } from '../runtime-settings.js';
import { getEvaluationsCollection } from '../db.js';
import { computeScoringConfigRevision } from '../scoring-config-revision.js';
import { normalizeEvaluationConfig } from '../evaluation-config.js';
import { needsAutomationMetadataPrep } from './constants.js';
import { getActiveCriteria } from './criteria.js';
import {
  allAnswersHaveEqualTotals,
  computeTotalPoints,
  initialScoresForCriteria,
  parseJudgeBatchScoreResponse,
  pickWinner,
  scaleAnswerScores,
} from './scores.js';
import { LogEvents } from '../logging/events.js';
import { logEvent } from '../logging/logger.js';
import { chat, chatJson } from '../llm/chat.js';
import type { CompleteContext } from '../llm/rate-limit.js';
import { createTokenAccumulator, type TokenAccumulator } from '../llm/token-accumulator.js';
import { mapWithConcurrency } from '../util/concurrency.js';
import {
  buildBatchScorePrompt,
  buildComparativeRankPrompt,
  buildImprovedPrompt,
  buildGenerateSystem,
  JUDGE_BATCH_SCORE_SYSTEM,
  JUDGE_IMPROVED_SYSTEM,
  JUDGE_RANK_SYSTEM,
  parseImprovedAnswer,
} from '../llm/prompts.js';
import {
  isUnusableAnswerModel,
  stripModelArtifacts,
} from '../llm/sanitize-model-output.js';
import {
  providerChoiceTimeoutLabel,
  providerChoiceWaitTimeoutLabel,
  waitForProviderChoice,
} from './provider-choice.js';
import {
  clearAutomationRun,
  getActiveAutomationRunId,
  isAutomationCancelled,
  ownsAutomationRun,
  registerAutomationRun,
} from './run-registry.js';
import { modelIdToLabel } from '../llm/model-presets.js';
import { generateEvaluationMetadata } from './metadata.js';
import { createLlmProvider, resolveProvider } from '../llm/provider.js';
import {
  answersFromSlots,
  buildFallbackCandidates,
  callSingleModelWithFallback,
  isFallbackEligible,
  mapAnswersToSlots,
  pendingSlotIndices,
  validateAnswersForScoring,
  validateScoredAnswers,
  type FallbackCandidate,
  type ModelFallbackHandlers,
} from './resilient-llm.js';
import { isRateLimitExhausted } from '../llm/rate-limit.js';
import type {
  AutomationPhase,
  AutomationProgressEvent,
  AutomationStep,
  ChatMessage,
  ProgressCallback,
  ResolvedLlmSetup,
  StepPausedReason,
} from '../llm/types.js';

export type { AutomationPhase };
import { normalizeEvaluationRecord, toApiEvaluation } from '../serialization.js';
import type {
  Answer,
  Evaluation,
  EvaluationDocument,
  EvaluationConfig,
  ImprovedAnswer,
  RubricCriterion,
} from '../types/evaluation.js';

export class AutomationError extends Error {
  constructor(
    message: string,
    readonly step: AutomationStep,
  ) {
    super(message);
    this.name = 'AutomationError';
  }
}

function assertNotCancelled(signal: AbortSignal, step: AutomationStep): void {
  if (isAutomationCancelled(signal)) {
    throw new AutomationError('Automation cancelled.', step);
  }
}

/** Guard shared Mongo writes: abort signal and registry ownership (supersede). */
function assertCanPersist(
  evaluationId: string,
  runId: string,
  signal: AbortSignal,
  step: AutomationStep,
): void {
  assertNotCancelled(signal, step);

  if (!ownsAutomationRun(evaluationId, runId)) {
    throw new AutomationError('Automation cancelled.', step);
  }
}

function emit(onProgress: ProgressCallback, event: AutomationProgressEvent): void {
  onProgress(event);
}

const PIPELINE_STEPS = [
  'generating',
  'scoring',
  'improved',
] as const satisfies readonly AutomationStep[];

function logAutomationStepComplete(
  completed: (typeof PIPELINE_STEPS)[number],
  runId: string,
  evaluationId: string,
): void {
  const i = PIPELINE_STEPS.indexOf(completed);
  const next = PIPELINE_STEPS[i + 1];
  if (next) {
    logEvent('info', LogEvents.automationPipelineStep, {
      runId,
      evaluationId,
      completed,
      nextStep: next,
      message: `Next step: ${next}`,
    });
  } else {
    logEvent('info', LogEvents.automationPipelineStep, {
      runId,
      evaluationId,
      completed,
      message: 'Automation complete',
    });
  }
}

function createLlmCallContext(
  setup: ResolvedLlmSetup,
  runId: string,
  evaluationId: string,
  onProgress: ProgressCallback,
  signal: AbortSignal,
  accumulator: TokenAccumulator,
): CompleteContext {
  let switchedToCloud = false;
  let providerChoicePromise: Promise<boolean> | null = null;
  const ctx: CompleteContext = {
    runId,
    evaluationId,
    abortSignal: signal,
    currentSetup: setup,
    skipSlowFallback: false,
    requestProviderChoice: async ({ currentProvider, cloudProvider }) => {
      if (!providerChoicePromise) {
        emit(onProgress, {
          type: 'slow_provider_prompt',
          runId,
          currentProvider,
          cloudProvider,
          elapsedLabel: providerChoiceTimeoutLabel(),
          choiceTimeoutLabel: providerChoiceWaitTimeoutLabel(),
        });
        emit(onProgress, { type: 'status', status: 'waiting', runId });

        providerChoicePromise = waitForProviderChoice(evaluationId, runId, signal)
          .then((useCloud) => {
            emit(onProgress, { type: 'status', status: 'running', runId });
            return useCloud;
          })
          .finally(() => {
            providerChoicePromise = null;
          });
      }

      return providerChoicePromise;
    },
    onCloudProviderSwitch: (cloudSetup) => {
      if (switchedToCloud || setup.providerName === cloudSetup.providerName) {
        return;
      }

      switchedToCloud = true;
      const from = setup.providerName;
      Object.assign(setup, cloudSetup);
      logEvent('warn', LogEvents.automationProviderFallback, {
        runId,
        evaluationId,
        message: `Switched from ${from} to ${cloudSetup.providerName} after user chose cloud`,
      });
      emit(onProgress, { type: 'provider_fallback', from, to: cloudSetup.providerName });
    },
    onPreferLocalProvider: () => {
      ctx.skipSlowFallback = true;
    },
    recordUsage: (usage) => {
      accumulator.add(usage);
      emit(onProgress, { type: 'token_usage', usage: accumulator.totals() });
    },
  };

  return ctx;
}

function tokenUsageField(accumulator: TokenAccumulator): {
  tokenUsage: ReturnType<TokenAccumulator['totals']>;
} {
  return { tokenUsage: accumulator.totals() };
}

function classifyAnswerRejectReason(error: unknown): StepPausedReason {
  if (isRateLimitExhausted(error)) {
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

function toStepPausedReason(reason: string | undefined): StepPausedReason {
  if (
    reason === 'rate_limit' ||
    reason === 'empty_content' ||
    reason === 'unusable_model' ||
    reason === 'failed'
  ) {
    return reason;
  }

  return 'failed';
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function logAnswerRejected(
  context: {
    runId?: string;
    evaluationId?: string;
    provider?: string;
    model: string;
    resolvedModel?: string;
    step: AutomationStep;
    slotIndex?: number;
  },
  error: unknown,
): void {
  logEvent('warn', LogEvents.automationAnswerRejected, {
    ...context,
    reason: classifyAnswerRejectReason(error),
    detail: error instanceof Error ? error.message : String(error),
  });
}

function modelFallbackHandlers(
  onProgress: ProgressCallback,
  step: AutomationStep,
  slotIndex?: number,
  pause?: { completed: number; pending: number; reason?: StepPausedReason },
): ModelFallbackHandlers {
  let pauseEmitted = false;

  return {
    onModelFallback: (fromModel: string, toModel: string, index?: number, reason?: string) => {
      if (pause && !pauseEmitted) {
        pauseEmitted = true;
        emit(onProgress, {
          type: 'step_paused',
          step,
          reason: pause.reason ?? toStepPausedReason(reason),
          completed: pause.completed,
          pending: pause.pending,
        });
      }

      logEvent('warn', LogEvents.automationModelFallback, {
        step,
        fromModel,
        toModel,
        ...(index !== undefined ? { slotIndex: index } : {}),
        ...(reason ? { reason } : {}),
      });

      emit(onProgress, {
        type: 'model_fallback',
        step,
        fromModel,
        toModel,
        ...(index !== undefined ? { slotIndex: index } : {}),
      });
    },
  };
}

function candidateKey(candidate: FallbackCandidate): string {
  return `${candidate.providerName}:${candidate.model}`;
}

async function buildJudgeCandidates(
  setup: ResolvedLlmSetup,
  evaluationConfig: EvaluationConfig,
): Promise<FallbackCandidate[]> {
  const candidates = await buildFallbackCandidates(setup, 'judge', 0);
  const requested = evaluationConfig.judgeProfile.model;

  if (!requested || candidates.some((candidate) => candidate.model === requested)) {
    return candidates;
  }

  return [
    { providerName: setup.providerName, model: requested, label: modelIdToLabel(requested) },
    ...candidates,
  ];
}

async function persistGenerateCheckpoint(
  docId: ObjectId,
  answers: Answer[],
  accumulator: TokenAccumulator,
  gate: PersistGate,
): Promise<void> {
  const now = new Date().toISOString();

  await persistEvaluation(
    docId,
    { answers, updatedAt: now, ...tokenUsageField(accumulator) },
    { winnerAnswerId: '', improvedAnswer: '', automatedAt: '' },
    'generating',
    gate,
  );
}

async function generateOneAnswerSlot(
  setup: ResolvedLlmSetup,
  evaluationId: string,
  prompt: string,
  criteria: RubricCriterion[],
  evaluationConfig: EvaluationConfig,
  slotIndex: number,
  runId: string,
  onProgress: ProgressCallback,
  signal: AbortSignal,
  llmCtx: CompleteContext,
  candidate: FallbackCandidate,
): Promise<Answer> {
  assertNotCancelled(signal, 'generating');

  const total = setup.answerModels.length;
  const progressLabel = evaluationConfig.blindJudging
    ? `Answer ${String.fromCharCode(65 + slotIndex)}`
    : candidate.label;
  const generateMessages: ChatMessage[] = [
    { role: 'system', content: buildGenerateSystem(evaluationConfig) },
    { role: 'user', content: prompt },
  ];

  emit(onProgress, {
    type: 'generating',
    modelLabel: progressLabel,
    index: slotIndex + 1,
    total,
  });
  logEvent('info', LogEvents.automationGenerating, {
    runId,
    evaluationId,
    provider: candidate.providerName,
    model: candidate.model,
    step: 'generating',
  });

  const provider =
    candidate.providerName === setup.providerName
      ? setup.provider
      : createLlmProvider(candidate.providerName);

  const start = Date.now();
  const completion = await chat(provider, candidate.model, generateMessages, {
    ...llmCtx,
    provider: candidate.providerName,
    model: candidate.model,
    step: 'generating',
  });
  const effectiveModel = completion.resolvedModel ?? candidate.model;
  const label = modelIdToLabel(effectiveModel);

  // OpenRouter `openrouter/free` can route to guardrail classifiers (e.g. Nemotron
  // Content Safety) that only emit "User Safety: safe" — reject so fallback runs.
  if (isUnusableAnswerModel(effectiveModel)) {
    throw new Error(
      `Answer ${label} has empty content (unusable model: ${effectiveModel}).`,
    );
  }

  const content = stripModelArtifacts(completion.text);

  if (!content) {
    throw new Error(`Answer ${label} has empty content (sanitized empty).`);
  }

  const answer: Answer = {
    id: crypto.randomUUID(),
    evaluationId,
    label,
    content,
    scores: initialScoresForCriteria(criteria),
    provider: candidate.providerName,
    model: effectiveModel,
    slotIndex,
  };

  logEvent('info', LogEvents.automationAnswerGenerated, {
    runId,
    evaluationId,
    provider: candidate.providerName,
    model: candidate.model,
    ...(completion.resolvedModel ? { resolvedModel: completion.resolvedModel } : {}),
    step: 'generating',
    durationMs: Date.now() - start,
    answerId: answer.id,
  });
  emit(onProgress, {
    type: 'answer_generated',
    answerId: answer.id,
    label: evaluationConfig.blindJudging ? progressLabel : answer.label,
  });

  return answer;
}

async function generateAnswers(
  setup: ResolvedLlmSetup,
  evaluationId: string,
  prompt: string,
  criteria: RubricCriterion[],
  evaluationConfig: EvaluationConfig,
  runId: string,
  onProgress: ProgressCallback,
  signal: AbortSignal,
  llmCtx: CompleteContext,
  options?: {
    existingAnswers?: Answer[];
    docId?: ObjectId;
    accumulator?: TokenAccumulator;
  },
): Promise<Answer[]> {
  const total = setup.answerModels.length;
  const slots = mapAnswersToSlots(options?.existingAnswers ?? [], setup);
  const attempted = new Set<string>();
  let lastPendingReason: StepPausedReason = 'failed';

  for (const [index, slot] of slots.entries()) {
    if (!slot) {
      continue;
    }

    if (slot.provider && slot.model) {
      attempted.add(`${slot.provider}:${slot.model}`);
      continue;
    }

    const modelRef = setup.answerModels[index];

    if (modelRef) {
      attempted.add(`${setup.providerName}:${modelRef.model}`);
    }
  }

  let pending = pendingSlotIndices(slots);

  if (pending.length > 0) {
    await mapWithConcurrency(pending, config.llmConcurrency, async (slotIndex) => {
      assertNotCancelled(signal, 'generating');

      const modelRef = setup.answerModels[slotIndex]!;

      try {
        const answer = await generateOneAnswerSlot(
          setup,
          evaluationId,
          prompt,
          criteria,
          evaluationConfig,
          slotIndex,
          runId,
          onProgress,
          signal,
          llmCtx,
          {
            providerName: setup.providerName,
            model: modelRef.model,
            label: modelRef.label,
          },
        );
        slots[slotIndex] = answer;
        attempted.add(
          `${answer.provider ?? setup.providerName}:${answer.model ?? modelRef.model}`,
        );
      } catch (error) {
        if (
          isAutomationCancelled(signal) ||
          (isAbortError(error) && signal.aborted)
        ) {
          throw new AutomationError('Automation cancelled.', 'generating');
        }

        // Leave the slot null so sequential fallback can try another model.
        if (!isFallbackEligible(error)) {
          throw error;
        }

        lastPendingReason = classifyAnswerRejectReason(error);
        logAnswerRejected(
          {
            runId,
            evaluationId,
            provider: setup.providerName,
            model: modelRef.model,
            step: 'generating',
            slotIndex,
          },
          error,
        );
        attempted.add(`${setup.providerName}:${modelRef.model}`);
      }
    });
  }

  pending = pendingSlotIndices(slots);

  if (pending.length > 0 && options?.docId && options.accumulator) {
    const checkpointAnswers = answersFromSlots(slots);

    if (checkpointAnswers.length > 0) {
      validateAnswersForScoring(checkpointAnswers, criteria, total);
      await persistGenerateCheckpoint(options.docId, checkpointAnswers, options.accumulator, {
        evaluationId,
        runId,
        signal,
      });
      emit(onProgress, {
        type: 'step_paused',
        step: 'generating',
        reason: lastPendingReason,
        completed: checkpointAnswers.length,
        pending: pending.length,
      });
    }
  }

  for (const slotIndex of pending) {
    assertNotCancelled(signal, 'generating');

    const candidates = await buildFallbackCandidates(setup, 'answer', slotIndex, signal);

    slots[slotIndex] = await callSingleModelWithFallback(
      candidates,
      modelFallbackHandlers(onProgress, 'generating', slotIndex),
      slotIndex,
      async (_provider, _model, candidate) =>
        generateOneAnswerSlot(
          setup,
          evaluationId,
          prompt,
          criteria,
          evaluationConfig,
          slotIndex,
          runId,
          onProgress,
          signal,
          llmCtx,
          candidate,
        ),
      attempted,
      signal,
    );

    const filled = slots[slotIndex];

    if (filled?.provider && filled.model) {
      attempted.add(`${filled.provider}:${filled.model}`);
    }

    if (options?.docId && options.accumulator) {
      const checkpointAnswers = answersFromSlots(slots);

      if (checkpointAnswers.length > 0) {
        validateAnswersForScoring(checkpointAnswers, criteria, total);
        await persistGenerateCheckpoint(options.docId, checkpointAnswers, options.accumulator, {
          evaluationId,
          runId,
          signal,
        });
      }
    }
  }

  const answers = answersFromSlots(slots);

  if (answers.length !== total) {
    const reasonLabel = lastPendingReason.replace(/_/g, ' ');
    throw new AutomationError(
      `Could not generate all model answers after ${reasonLabel} retries.`,
      'generating',
    );
  }

  validateAnswersForScoring(answers, criteria, total);

  return answers;
}

async function scoreAnswers(
  setup: ResolvedLlmSetup,
  evaluationId: string,
  prompt: string,
  criteria: RubricCriterion[],
  answers: Answer[],
  evaluationConfig: EvaluationConfig,
  runId: string,
  onProgress: ProgressCallback,
  signal: AbortSignal,
  llmCtx: CompleteContext,
): Promise<Answer[]> {
  assertNotCancelled(signal, 'scoring');

  const candidates = await buildJudgeCandidates(setup, evaluationConfig);

  emit(onProgress, {
    type: 'scoring_batch',
    modelLabel: candidates[0]?.label ?? setup.judgeModel.label,
  });

  for (const answer of answers) {
    emit(onProgress, { type: 'scoring', answerId: answer.id, label: answer.label });
    logEvent('info', LogEvents.automationScoring, {
      runId,
      evaluationId,
      answerId: answer.id,
      step: 'scoring',
    });
  }

  const judgeSystem: ChatMessage = {
    role: 'system',
    content: JUDGE_BATCH_SCORE_SYSTEM,
  };

  const userContent = buildBatchScorePrompt(prompt, criteria, answers, evaluationConfig);
  const messages: ChatMessage[] = [judgeSystem, { role: 'user', content: userContent }];

  const rows = await callSingleModelWithFallback(
    candidates,
    modelFallbackHandlers(onProgress, 'scoring', undefined, {
      completed: answers.length,
      pending: 1,
    }),
    undefined,
    async (provider, model) =>
      chatJson(
        provider,
        model,
        messages,
        { ...llmCtx, provider: provider.name, model, step: 'scoring' },
        (raw) => parseJudgeBatchScoreResponse(raw, criteria, answers),
      ),
    undefined,
    signal,
  );
  assertNotCancelled(signal, 'scoring');

  const scored = rows.map((row, index) => {
    const answer = answers[index]!;
    const totalPoints = row.scores.reduce((sum, s) => sum + s.points, 0);

    logEvent('info', LogEvents.automationScored, {
      runId,
      evaluationId,
      answerId: answer.id,
      totalPoints,
      step: 'scoring',
    });
    emit(onProgress, {
      type: 'scored',
      answerId: answer.id,
      totalPoints,
      ...(row.answerNotes ? { notes: row.answerNotes } : {}),
    });

    return {
      ...answer,
      scores: row.scores,
      ...(row.answerNotes ? { notes: row.answerNotes } : {}),
    };
  });

  return rebalanceTiedScores(
    setup,
    evaluationId,
    prompt,
    criteria,
    scored,
    evaluationConfig,
    runId,
    onProgress,
    signal,
    llmCtx,
  );
}

interface ComparativeRanking {
  answerId: string;
  qualityPercent: number;
}

function parseComparativeRankings(raw: unknown, answerIds: string[]): ComparativeRanking[] {
  if (!raw || typeof raw !== 'object' || !('rankings' in raw)) {
    throw new Error('Invalid comparative ranking JSON');
  }

  const entries = (raw as { rankings: unknown }).rankings;

  if (!Array.isArray(entries)) {
    throw new Error('Invalid comparative rankings array');
  }

  const byId = new Map<string, number>();

  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }

    const answerId = (entry as { answerId?: unknown }).answerId;
    const qualityPercent = (entry as { qualityPercent?: unknown }).qualityPercent;

    if (typeof answerId === 'string' && typeof qualityPercent === 'number') {
      byId.set(answerId, qualityPercent);
    }
  }

  return answerIds.map((answerId) => ({
    answerId,
    qualityPercent: byId.get(answerId) ?? 0,
  }));
}

async function rebalanceTiedScores(
  setup: ResolvedLlmSetup,
  evaluationId: string,
  prompt: string,
  criteria: RubricCriterion[],
  answers: Answer[],
  evaluationConfig: EvaluationConfig,
  runId: string,
  onProgress: ProgressCallback,
  signal: AbortSignal,
  llmCtx: CompleteContext,
): Promise<Answer[]> {
  if (!allAnswersHaveEqualTotals(answers, criteria)) {
    return answers;
  }

  assertNotCancelled(signal, 'scoring');

  const rankMessages: ChatMessage[] = [
    { role: 'system', content: JUDGE_RANK_SYSTEM },
    {
      role: 'user',
      content: buildComparativeRankPrompt(prompt, criteria, answers, evaluationConfig),
    },
  ];
  const rankCandidates = await buildJudgeCandidates(setup, evaluationConfig);

  const rankings = await callSingleModelWithFallback(
    rankCandidates,
    modelFallbackHandlers(onProgress, 'scoring'),
    undefined,
    async (provider, model) =>
      chatJson(
        provider,
        model,
        rankMessages,
        { ...llmCtx, provider: provider.name, model, step: 'scoring' },
        (raw) =>
          parseComparativeRankings(
            raw,
            answers.map((answer) => answer.id),
          ),
      ),
    undefined,
    signal,
  );
  assertNotCancelled(signal, 'scoring');

  const bestPercent = Math.max(...rankings.map((entry) => entry.qualityPercent));

  if (bestPercent <= 0 || new Set(rankings.map((entry) => entry.qualityPercent)).size === 1) {
    return answers;
  }

  logEvent('info', LogEvents.automationScored, {
    runId,
    evaluationId,
    step: 'scoring',
    message: 'Rebalanced tied scores using comparative ranking',
  });

  return answers.map((answer) => {
    const qualityPercent =
      rankings.find((entry) => entry.answerId === answer.id)?.qualityPercent ?? 0;
    const factor = qualityPercent / bestPercent;

    if (factor === 1) {
      return answer;
    }

    const scaled = scaleAnswerScores(answer, factor);
    const totalPoints = computeTotalPoints(scaled.scores);

    emit(onProgress, { type: 'scored', answerId: answer.id, totalPoints });

    return scaled;
  });
}

async function synthesizeImproved(
  setup: ResolvedLlmSetup,
  evaluationId: string,
  prompt: string,
  criteria: RubricCriterion[],
  answers: Answer[],
  winner: Answer,
  runId: string,
  onProgress: ProgressCallback,
  signal: AbortSignal,
  llmCtx: CompleteContext,
): Promise<ImprovedAnswer> {
  assertNotCancelled(signal, 'improved');

  const improvedPrompt = buildImprovedPrompt(prompt, criteria, answers, winner);
  const improvedMessages: ChatMessage[] = [
    { role: 'system', content: JUDGE_IMPROVED_SYSTEM },
    { role: 'user', content: improvedPrompt },
  ];
  const improvedCandidates = await buildFallbackCandidates(setup, 'judge', 0, signal);

  emit(onProgress, {
    type: 'improved_generating',
    modelLabel: improvedCandidates[0]?.label ?? setup.judgeModel.label,
  });
  logEvent('info', LogEvents.automationImprovedGenerating, {
    runId,
    evaluationId,
    step: 'improved',
  });

  const improved = await callSingleModelWithFallback(
    improvedCandidates,
    modelFallbackHandlers(onProgress, 'improved'),
    undefined,
    async (provider, model) =>
      chatJson(
        provider,
        model,
        improvedMessages,
        { ...llmCtx, provider: provider.name, model, step: 'improved' },
        parseImprovedAnswer,
      ),
    undefined,
    signal,
  );

  logEvent('info', LogEvents.automationImprovedDone, { runId, evaluationId, step: 'improved' });
  emit(onProgress, { type: 'improved_done' });

  return improved;
}

interface PersistGate {
  evaluationId: string;
  runId: string;
  signal: AbortSignal;
}

/**
 * Stamp automationRunId on the doc so later writes can filter by ownership.
 * If superseded during the await, restore the active owner's claim when we stomped it.
 */
async function claimEvaluationAutomationRun(
  docId: ObjectId,
  evaluationId: string,
  runId: string,
  signal: AbortSignal,
  step: AutomationStep,
): Promise<void> {
  assertCanPersist(evaluationId, runId, signal, step);

  await getEvaluationsCollection().updateOne({ _id: docId }, { $set: { automationRunId: runId } });

  if (!ownsAutomationRun(evaluationId, runId)) {
    const ownerId = getActiveAutomationRunId(evaluationId);

    if (ownerId) {
      await getEvaluationsCollection().updateOne(
        { _id: docId, automationRunId: runId },
        { $set: { automationRunId: ownerId } },
      );
    }

    throw new AutomationError('Automation cancelled.', step);
  }
}

function ownershipFilter(docId: ObjectId, runId: string): { _id: ObjectId; automationRunId: string } {
  return { _id: docId, automationRunId: runId };
}

async function updateEvaluationOwned(
  docId: ObjectId,
  gate: PersistGate,
  update: { $set?: Record<string, unknown>; $unset?: Record<string, ''> },
  errorStep: AutomationStep,
): Promise<void> {
  assertCanPersist(gate.evaluationId, gate.runId, gate.signal, errorStep);

  const result = await getEvaluationsCollection().updateOne(
    ownershipFilter(docId, gate.runId),
    update,
  );

  if (result.matchedCount === 0) {
    assertCanPersist(gate.evaluationId, gate.runId, gate.signal, errorStep);
    throw new AutomationError('Failed to save evaluation.', errorStep);
  }
}

async function persistEvaluation(
  docId: ObjectId,
  set: Record<string, unknown>,
  unset: Record<string, ''> | undefined,
  errorStep: AutomationStep,
  gate: PersistGate,
): Promise<EvaluationDocument> {
  assertCanPersist(gate.evaluationId, gate.runId, gate.signal, errorStep);

  const update: { $set: Record<string, unknown>; $unset?: Record<string, ''> } = {
    $set: { ...set, automationRunId: gate.runId },
  };

  if (unset && Object.keys(unset).length > 0) {
    update.$unset = unset;
  }

  const result = await getEvaluationsCollection().findOneAndUpdate(
    ownershipFilter(docId, gate.runId),
    update,
    { returnDocument: 'after' },
  );

  if (!result) {
    assertCanPersist(gate.evaluationId, gate.runId, gate.signal, errorStep);
    throw new AutomationError('Failed to save evaluation.', errorStep);
  }

  return result;
}

function finishAutomation(
  doc: EvaluationDocument,
  runId: string,
  evaluationId: string,
  onProgress: ProgressCallback,
  automatedAt?: string,
): Evaluation {
  const evaluation = toApiEvaluation(doc);
  logEvent('info', LogEvents.automationComplete, {
    runId,
    evaluationId,
    ...(automatedAt ? { automatedAt } : {}),
  });
  emit(onProgress, { type: 'complete', evaluation, status: 'completed' });

  return evaluation;
}

function requirePromptAndCriteria(doc: EvaluationDocument): {
  prompt: string;
  criteria: RubricCriterion[];
} {
  const prompt = doc.prompt;

  if (!prompt.trim()) {
    throw new AutomationError('Evaluation prompt is required.', 'generating');
  }

  const criteria = getActiveCriteria(doc.criteriaMode, doc.criteria);

  if (criteria.length === 0) {
    throw new AutomationError('At least one rubric criterion is required.', 'scoring');
  }

  return { prompt, criteria };
}

function findWinnerAnswer(answers: Answer[], winnerAnswerId?: string): Answer | undefined {
  if (winnerAnswerId) {
    return answers.find((answer) => answer.id === winnerAnswerId);
  }

  return answers.find((answer) => answer.isWinner);
}

async function applyWinner(
  scored: Answer[],
  criteria: RubricCriterion[],
  runId: string,
  evaluationId: string,
  onProgress: ProgressCallback,
): Promise<{ answersWithWinner: Answer[]; winner: Answer; winnerAnswerId: string }> {
  const winnerResult = pickWinner(scored, criteria);

  if (!winnerResult) {
    throw new AutomationError('No winner could be determined.', 'scoring');
  }

  const answersWithWinner = scored.map((answer) => ({
    ...answer,
    isWinner: answer.id === winnerResult.answerId,
  }));
  const winner = answersWithWinner.find((a) => a.id === winnerResult.answerId)!;

  logEvent('info', LogEvents.automationWinnerPicked, {
    runId,
    evaluationId,
    answerId: winnerResult.answerId,
    totalPoints: winnerResult.totalPoints,
  });
  emit(onProgress, {
    type: 'winner_picked',
    answerId: winnerResult.answerId,
    label: winnerResult.label,
  });

  return { answersWithWinner, winner, winnerAnswerId: winnerResult.answerId };
}

async function runGeneratePhase(
  setup: ResolvedLlmSetup,
  doc: EvaluationDocument,
  runId: string,
  onProgress: ProgressCallback,
  signal: AbortSignal,
): Promise<Evaluation> {
  const evaluationId = doc._id.toString();
  const accumulator = createTokenAccumulator(doc.tokenUsage);
  const llmCtx = createLlmCallContext(setup, runId, evaluationId, onProgress, signal, accumulator);
  const preparedDoc = await ensureAutomationMetadata(
    doc,
    setup,
    runId,
    onProgress,
    signal,
    llmCtx,
    accumulator,
    modelFallbackHandlers(onProgress, 'generating'),
  );
  const { prompt, criteria } = requirePromptAndCriteria(preparedDoc);
  const gate: PersistGate = { evaluationId, runId, signal };

  const answers = await generateAnswers(
    setup,
    evaluationId,
    prompt,
    criteria,
    doc.evaluationConfig,
    runId,
    onProgress,
    signal,
    llmCtx,
    { existingAnswers: preparedDoc.answers, docId: preparedDoc._id, accumulator },
  );
  logAutomationStepComplete('generating', runId, evaluationId);
  assertNotCancelled(signal, 'generating');

  const now = new Date().toISOString();
  const saved = await persistEvaluation(
    preparedDoc._id,
    { answers, updatedAt: now, ...tokenUsageField(accumulator) },
    { winnerAnswerId: '', improvedAnswer: '', automatedAt: '' },
    'generating',
    gate,
  );

  return finishAutomation(saved, runId, evaluationId, onProgress);
}

async function runScorePhase(
  setup: ResolvedLlmSetup,
  doc: EvaluationDocument,
  runId: string,
  onProgress: ProgressCallback,
  signal: AbortSignal,
): Promise<Evaluation> {
  const evaluationId = doc._id.toString();
  const accumulator = createTokenAccumulator(doc.tokenUsage);
  const llmCtx = createLlmCallContext(setup, runId, evaluationId, onProgress, signal, accumulator);
  const preparedDoc = await ensureAutomationMetadata(
    doc,
    setup,
    runId,
    onProgress,
    signal,
    llmCtx,
    accumulator,
    modelFallbackHandlers(onProgress, 'scoring'),
  );
  const { prompt, criteria } = requirePromptAndCriteria(preparedDoc);

  if (preparedDoc.answers.length === 0) {
    throw new AutomationError('Add answers before auto-scoring.', 'scoring');
  }

  const expectedCount = setup.answerModels.length;

  if (preparedDoc.answers.length !== expectedCount) {
    throw new AutomationError(
      `Need all ${expectedCount} model answers before scoring (have ${preparedDoc.answers.length}).`,
      'scoring',
    );
  }

  validateAnswersForScoring(preparedDoc.answers, criteria, expectedCount);

  const gate: PersistGate = { evaluationId, runId, signal };
  const scored = await scoreAnswers(
    setup,
    evaluationId,
    prompt,
    criteria,
    preparedDoc.answers,
    preparedDoc.evaluationConfig,
    runId,
    onProgress,
    signal,
    llmCtx,
  );
  validateScoredAnswers(scored, criteria);
  logAutomationStepComplete('scoring', runId, evaluationId);
  assertNotCancelled(signal, 'scoring');

  const { answersWithWinner, winnerAnswerId } = await applyWinner(
    scored,
    criteria,
    runId,
    evaluationId,
    onProgress,
  );
  const now = new Date().toISOString();
  const scoringConfigRevision = computeScoringConfigRevision(doc, criteria);
  const saved = await persistEvaluation(
    preparedDoc._id,
    {
      answers: answersWithWinner,
      winnerAnswerId,
      automatedAt: now,
      updatedAt: now,
      scoringConfigRevision,
      lastScoringRun: {
        at: now,
        strictness: doc.evaluationConfig.judgeProfile.strictness,
        judgeModel: doc.evaluationConfig.judgeProfile.model ?? setup.judgeModel.model,
      },
      ...tokenUsageField(accumulator),
    },
    { improvedAnswer: '' },
    'scoring',
    gate,
  );

  return finishAutomation(saved, runId, evaluationId, onProgress, now);
}

async function runImprovedPhase(
  setup: ResolvedLlmSetup,
  doc: EvaluationDocument,
  runId: string,
  onProgress: ProgressCallback,
  signal: AbortSignal,
): Promise<Evaluation> {
  const evaluationId = doc._id.toString();
  const accumulator = createTokenAccumulator(doc.tokenUsage);
  const llmCtx = createLlmCallContext(setup, runId, evaluationId, onProgress, signal, accumulator);
  const preparedDoc = await ensureAutomationMetadata(
    doc,
    setup,
    runId,
    onProgress,
    signal,
    llmCtx,
    accumulator,
    modelFallbackHandlers(onProgress, 'improved'),
  );
  const { prompt, criteria } = requirePromptAndCriteria(preparedDoc);
  const winner = findWinnerAnswer(preparedDoc.answers, preparedDoc.winnerAnswerId);

  if (!winner) {
    throw new AutomationError('Mark a winner before generating an improved answer.', 'improved');
  }

  const gate: PersistGate = { evaluationId, runId, signal };
  const improvedAnswer = await synthesizeImproved(
    setup,
    evaluationId,
    prompt,
    criteria,
    preparedDoc.answers,
    winner,
    runId,
    onProgress,
    signal,
    llmCtx,
  );
  logAutomationStepComplete('improved', runId, evaluationId);
  assertNotCancelled(signal, 'improved');

  const now = new Date().toISOString();
  const saved = await persistEvaluation(
    preparedDoc._id,
    { improvedAnswer, updatedAt: now, ...tokenUsageField(accumulator) },
    undefined,
    'improved',
    gate,
  );

  return finishAutomation(saved, runId, evaluationId, onProgress);
}

async function ensureAutomationMetadata(
  doc: EvaluationDocument,
  setup: ResolvedLlmSetup,
  runId: string,
  onProgress: ProgressCallback,
  signal: AbortSignal,
  llmCtx: CompleteContext,
  accumulator: TokenAccumulator,
  handlers: ModelFallbackHandlers,
): Promise<EvaluationDocument> {
  if (!needsAutomationMetadataPrep(doc)) {
    return doc;
  }

  const evaluationId = doc._id.toString();
  assertNotCancelled(signal, 'generating');

  const evaluationConfig = normalizeEvaluationConfig(doc.evaluationConfig);
  const { title, prompt } = await generateEvaluationMetadata(
    setup,
    handlers,
    llmCtx,
    evaluationConfig,
  );
  const now = new Date().toISOString();

  // Persist normalized config so legacy docs missing evaluationConfig stay usable
  // after metadata save (persistEvaluation returns raw Mongo, not the in-memory normalize).
  const saved = await persistEvaluation(
    doc._id,
    {
      title,
      prompt,
      evaluationConfig,
      updatedAt: now,
      ...tokenUsageField(accumulator),
    },
    undefined,
    'generating',
    { evaluationId, runId, signal },
  );

  logEvent('info', LogEvents.automationPipelineStep, {
    runId,
    evaluationId,
    message: 'Title and prompt generated',
    completed: 'metadata',
    nextStep: 'generating',
  });

  const normalized: EvaluationDocument = {
    _id: saved._id,
    ...normalizeEvaluationRecord(saved, evaluationId),
  };

  emit(onProgress, {
    type: 'metadata_generated',
    evaluation: toApiEvaluation(normalized),
  });
  emit(onProgress, { type: 'status', status: 'running', runId });

  return normalized;
}

async function runFullPipeline(
  setup: ResolvedLlmSetup,
  doc: EvaluationDocument,
  runId: string,
  onProgress: ProgressCallback,
  signal: AbortSignal,
): Promise<Evaluation> {
  const evaluationId = doc._id.toString();
  const accumulator = createTokenAccumulator(doc.tokenUsage);
  const llmCtx = createLlmCallContext(setup, runId, evaluationId, onProgress, signal, accumulator);
  const gate: PersistGate = { evaluationId, runId, signal };
  const preparedDoc = await ensureAutomationMetadata(
    doc,
    setup,
    runId,
    onProgress,
    signal,
    llmCtx,
    accumulator,
    modelFallbackHandlers(onProgress, 'generating'),
  );
  const { prompt, criteria } = requirePromptAndCriteria(preparedDoc);

  const answers = await generateAnswers(
    setup,
    evaluationId,
    prompt,
    criteria,
    preparedDoc.evaluationConfig,
    runId,
    onProgress,
    signal,
    llmCtx,
    { docId: preparedDoc._id, accumulator },
  );
  logAutomationStepComplete('generating', runId, evaluationId);

  await persistGenerateCheckpoint(preparedDoc._id, answers, accumulator, gate);

  const scored = await scoreAnswers(
    setup,
    evaluationId,
    prompt,
    criteria,
    answers,
    preparedDoc.evaluationConfig,
    runId,
    onProgress,
    signal,
    llmCtx,
  );
  validateScoredAnswers(scored, criteria);
  logAutomationStepComplete('scoring', runId, evaluationId);
  assertNotCancelled(signal, 'scoring');

  const { answersWithWinner, winner, winnerAnswerId } = await applyWinner(
    scored,
    criteria,
    runId,
    evaluationId,
    onProgress,
  );

  const improvedAnswer = await synthesizeImproved(
    setup,
    evaluationId,
    prompt,
    criteria,
    answersWithWinner,
    winner,
    runId,
    onProgress,
    signal,
    llmCtx,
  );
  logAutomationStepComplete('improved', runId, evaluationId);
  assertNotCancelled(signal, 'improved');

  const now = new Date().toISOString();
  const scoringConfigRevision = computeScoringConfigRevision(preparedDoc, criteria);
  const saved = await persistEvaluation(
    preparedDoc._id,
    {
      answers: answersWithWinner,
      winnerAnswerId,
      improvedAnswer,
      automatedAt: now,
      updatedAt: now,
      scoringConfigRevision,
      lastScoringRun: {
        at: now,
        strictness: preparedDoc.evaluationConfig.judgeProfile.strictness,
        judgeModel:
          preparedDoc.evaluationConfig.judgeProfile.model ?? setup.judgeModel.model,
      },
      ...tokenUsageField(accumulator),
    },
    undefined,
    'improved',
    gate,
  );

  return finishAutomation(saved, runId, evaluationId, onProgress, now);
}

async function runPhaseWithSetup(
  setup: ResolvedLlmSetup,
  doc: EvaluationDocument,
  runId: string,
  onProgress: ProgressCallback,
  signal: AbortSignal,
  phase: AutomationPhase,
): Promise<Evaluation> {
  switch (phase) {
    case 'generate':
      return runGeneratePhase(setup, doc, runId, onProgress, signal);
    case 'score':
      return runScorePhase(setup, doc, runId, onProgress, signal);
    case 'improved':
      return runImprovedPhase(setup, doc, runId, onProgress, signal);
    case 'full':
      return runFullPipeline(setup, doc, runId, onProgress, signal);
  }
}

function initialFailureStep(phase: AutomationPhase): AutomationStep {
  switch (phase) {
    case 'generate':
    case 'full':
      return 'generating';
    case 'score':
      return 'scoring';
    case 'improved':
      return 'improved';
  }
}

export async function prepareDocForPhase(
  doc: EvaluationDocument,
  phase: AutomationPhase,
  force: boolean,
  gate?: PersistGate,
): Promise<EvaluationDocument> {
  const now = new Date().toISOString();

  switch (phase) {
    case 'generate': {
      if (doc.answers.length > 0 && !force) {
        const setup = await resolveProvider();
        const expectedCount = setup.answerModels.length;
        const criteria = getActiveCriteria(doc.criteriaMode, doc.criteria);

        if (doc.answers.length >= expectedCount) {
          throw new AutomationError(
            'Evaluation already has answers. Re-run with force=true after confirming.',
            'generating',
          );
        }

        validateAnswersForScoring(doc.answers, criteria, expectedCount);

        return doc;
      }

      if (force && doc.answers.length > 0) {
        if (gate) {
          await updateEvaluationOwned(
            doc._id,
            gate,
            {
              $set: { answers: [], updatedAt: now },
              $unset: { winnerAnswerId: '', improvedAnswer: '', automatedAt: '' },
            },
            'generating',
          );
        } else {
          const collection = getEvaluationsCollection();
          await collection.updateOne(
            { _id: doc._id },
            {
              $set: { answers: [], updatedAt: now },
              $unset: { winnerAnswerId: '', improvedAnswer: '', automatedAt: '' },
            },
          );
        }

        return { ...doc, answers: [] };
      }

      return doc;
    }
    case 'score': {
      if (doc.answers.length === 0) {
        throw new AutomationError('Add answers before auto-scoring.', 'scoring');
      }

      {
        const setup = await resolveProvider();
        const expectedCount = setup.answerModels.length;

        if (doc.answers.length !== expectedCount) {
          throw new AutomationError(
            `Need all ${expectedCount} model answers before scoring (have ${doc.answers.length}).`,
            'scoring',
          );
        }
      }

      if ((doc.winnerAnswerId || doc.automatedAt) && !force) {
        throw new AutomationError(
          'Answers are already scored. Re-run with force=true after confirming.',
          'scoring',
        );
      }

      if (force && (doc.winnerAnswerId || doc.automatedAt)) {
        const answers = doc.answers.map((answer) => ({
          ...answer,
          isWinner: false,
        }));

        if (gate) {
          await updateEvaluationOwned(
            doc._id,
            gate,
            {
              $set: { answers, updatedAt: now },
              $unset: { winnerAnswerId: '', automatedAt: '', improvedAnswer: '' },
            },
            'scoring',
          );
        } else {
          const collection = getEvaluationsCollection();
          await collection.updateOne(
            { _id: doc._id },
            {
              $set: { answers, updatedAt: now },
              $unset: { winnerAnswerId: '', automatedAt: '', improvedAnswer: '' },
            },
          );
        }

        return {
          ...doc,
          answers,
          winnerAnswerId: undefined,
          improvedAnswer: undefined,
          automatedAt: undefined,
        };
      }

      return doc;
    }
    case 'improved': {
      const winner = findWinnerAnswer(doc.answers, doc.winnerAnswerId);

      if (!winner) {
        throw new AutomationError(
          'Mark a winner before generating an improved answer.',
          'improved',
        );
      }

      if (doc.improvedAnswer && !force) {
        throw new AutomationError(
          'An improved answer already exists. Re-run with force=true after confirming.',
          'improved',
        );
      }

      return doc;
    }
    case 'full':
      return doc;
  }
}

export async function runEvaluationAutomation(options: {
  evaluationObjectId: ObjectId;
  runId: string;
  force: boolean;
  phase?: AutomationPhase;
  onProgress: ProgressCallback;
}): Promise<Evaluation> {
  const { evaluationObjectId, runId, force } = options;
  const phase = options.phase ?? 'full';
  const collection = getEvaluationsCollection();
  const evaluationId = evaluationObjectId.toString();
  // Register before findOne / setup so cancel/disconnect after SSE runId is honored.
  const signal = registerAutomationRun(evaluationId, runId);

  // Stamp runId on every progress event so clients can drop stale streams.
  const onProgress: ProgressCallback = (event) => {
    if (typeof event.runId === 'string' && event.runId.length > 0) {
      options.onProgress(event);
      return;
    }

    options.onProgress({ ...event, runId });
  };

  logEvent('info', LogEvents.automationStarted, {
    runId,
    evaluationId,
    force,
    phase,
    preset: getLlmPreset(),
  });

  try {
    assertNotCancelled(signal, initialFailureStep(phase));

    const storedDoc = await collection.findOne({ _id: evaluationObjectId });

    if (!storedDoc) {
      throw new AutomationError('Evaluation not found.', initialFailureStep(phase));
    }

    const doc: EvaluationDocument = {
      _id: storedDoc._id,
      ...normalizeEvaluationRecord(storedDoc, evaluationId),
    };

    assertNotCancelled(signal, initialFailureStep(phase));

    // Resolve provider before any force-clear so setup failure does not wipe durable state.
    const setup = await resolveProvider();

    emit(onProgress, {
      type: 'provider_resolved',
      provider: setup.providerName,
    });
    logEvent('info', LogEvents.automationProviderResolved, {
      runId,
      evaluationId,
      provider: setup.providerName,
      models: setup.answerModels.map((m) => m.model).join(','),
      judge: setup.judgeModel.model,
    });

    assertNotCancelled(signal, initialFailureStep(phase));

    // Claim doc ownership after provider resolve so setup failure does not write;
    // subsequent persists/force-clears filter on automationRunId.
    await claimEvaluationAutomationRun(
      evaluationObjectId,
      evaluationId,
      runId,
      signal,
      initialFailureStep(phase),
    );

    let workingDoc = doc;

    if (phase === 'full') {
      if (doc.answers.length > 0 && !force) {
        throw new AutomationError(
          'Evaluation already has answers. Re-run with force=true after confirming.',
          'generating',
        );
      }

      if (force && doc.answers.length > 0) {
        await updateEvaluationOwned(
          doc._id,
          { evaluationId, runId, signal },
          {
            $set: {
              answers: [],
              updatedAt: new Date().toISOString(),
            },
            $unset: { winnerAnswerId: '', improvedAnswer: '', automatedAt: '' },
          },
          'generating',
        );
        workingDoc = { ...doc, answers: [] };
      }
    } else {
      workingDoc = await prepareDocForPhase(doc, phase, force, {
        evaluationId,
        runId,
        signal,
      });
    }

    assertNotCancelled(signal, initialFailureStep(phase));

    return await runPhaseWithSetup(setup, workingDoc, runId, onProgress, signal, phase);
  } catch (error) {
    if (error instanceof AutomationError) {
      logEvent('error', LogEvents.automationFailed, {
        runId,
        evaluationId,
        step: error.step,
        message: error.message,
      });
      throw error;
    }

    const step = initialFailureStep(phase);
    const cancelled =
      isAutomationCancelled(signal) ||
      (isAbortError(error) && signal.aborted) ||
      (error instanceof Error && /cancelled/i.test(error.message));
    const message = cancelled
      ? 'Automation cancelled.'
      : error instanceof Error
        ? error.message
        : 'Automation failed';
    logEvent('error', LogEvents.automationFailed, {
      runId,
      evaluationId,
      step,
      message,
    });
    throw new AutomationError(message, step);
  } finally {
    clearAutomationRun(evaluationId, runId);
  }
}
