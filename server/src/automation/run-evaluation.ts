import { ObjectId } from 'mongodb';

import { config } from '../config.js';
import { getLlmPreset } from '../runtime-settings.js';
import { getEvaluationsCollection } from '../db.js';
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
  GENERATE_SYSTEM,
  JUDGE_BATCH_SCORE_SYSTEM,
  JUDGE_IMPROVED_SYSTEM,
  JUDGE_RANK_SYSTEM,
  parseImprovedAnswer,
} from '../llm/prompts.js';
import { stripModelArtifacts } from '../llm/sanitize-model-output.js';
import { providerChoiceTimeoutLabel, waitForProviderChoice } from './provider-choice.js';
import {
  clearAutomationRun,
  isAutomationCancelled,
  registerAutomationRun,
} from './run-registry.js';
import { modelIdToLabel } from '../llm/model-presets.js';
import { generateEvaluationMetadata } from './metadata.js';
import { resolveNextProvider, resolveProvider } from '../llm/provider.js';
import type {
  AutomationPhase,
  AutomationProgressEvent,
  AutomationStep,
  ChatMessage,
  ProgressCallback,
  ResolvedLlmSetup,
} from '../llm/types.js';

export type { AutomationPhase };
import { toApiEvaluation } from '../serialization.js';
import type {
  Answer,
  Evaluation,
  EvaluationDocument,
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

function emit(onProgress: ProgressCallback, event: AutomationProgressEvent): void {
  onProgress(event);
}

const PIPELINE_STEPS = ['generating', 'scoring', 'improved'] as const satisfies readonly AutomationStep[];

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
        });

        providerChoicePromise = waitForProviderChoice(evaluationId, runId).finally(() => {
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

function tokenUsageField(accumulator: TokenAccumulator): { tokenUsage: ReturnType<TokenAccumulator['totals']> } {
  return { tokenUsage: accumulator.totals() };
}

async function generateAnswers(
  setup: ResolvedLlmSetup,
  evaluationId: string,
  prompt: string,
  criteria: RubricCriterion[],
  runId: string,
  onProgress: ProgressCallback,
  signal: AbortSignal,
  llmCtx: CompleteContext,
): Promise<Answer[]> {
  const total = setup.answerModels.length;
  const generateMessages: ChatMessage[] = [
    { role: 'system', content: GENERATE_SYSTEM },
    { role: 'user', content: prompt },
  ];

  return mapWithConcurrency(setup.answerModels, config.llmConcurrency, async (modelRef, index) => {
    assertNotCancelled(signal, 'generating');

    emit(onProgress, {
      type: 'generating',
      modelLabel: modelRef.label,
      index: index + 1,
      total,
    });
    logEvent('info', LogEvents.automationGenerating, {
      runId,
      evaluationId,
      provider: setup.providerName,
      model: modelRef.model,
      step: 'generating',
    });

    const start = Date.now();
    const completion = await chat(setup.provider, modelRef.model, generateMessages, {
      ...llmCtx,
      step: 'generating',
    });
    const label = modelIdToLabel(completion.resolvedModel ?? modelRef.model);

    const answer: Answer = {
      id: crypto.randomUUID(),
      evaluationId,
      label,
      content: stripModelArtifacts(completion.text),
      scores: initialScoresForCriteria(criteria),
    };

    logEvent('info', LogEvents.automationAnswerGenerated, {
      runId,
      evaluationId,
      provider: setup.providerName,
      model: modelRef.model,
      ...(completion.resolvedModel ? { resolvedModel: completion.resolvedModel } : {}),
      step: 'generating',
      durationMs: Date.now() - start,
      answerId: answer.id,
    });
    emit(onProgress, { type: 'answer_generated', answerId: answer.id, label: answer.label });

    return answer;
  });
}

async function scoreAnswers(
  setup: ResolvedLlmSetup,
  evaluationId: string,
  prompt: string,
  criteria: RubricCriterion[],
  answers: Answer[],
  runId: string,
  onProgress: ProgressCallback,
  signal: AbortSignal,
  llmCtx: CompleteContext,
): Promise<Answer[]> {
  assertNotCancelled(signal, 'scoring');

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

  const userContent = buildBatchScorePrompt(prompt, criteria, answers);

  const rows = await chatJson(
    setup.provider,
    setup.judgeModel.model,
    [judgeSystem, { role: 'user', content: userContent }],
    { ...llmCtx, step: 'scoring' },
    (raw) => parseJudgeBatchScoreResponse(raw, criteria, answers),
  );

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
  runId: string,
  onProgress: ProgressCallback,
  signal: AbortSignal,
  llmCtx: CompleteContext,
): Promise<Answer[]> {
  if (!allAnswersHaveEqualTotals(answers)) {
    return answers;
  }

  assertNotCancelled(signal, 'scoring');

  const rankings = await chatJson(
    setup.provider,
    setup.judgeModel.model,
    [
      { role: 'system', content: JUDGE_RANK_SYSTEM },
      { role: 'user', content: buildComparativeRankPrompt(prompt, criteria, answers) },
    ],
    { ...llmCtx, step: 'scoring' },
    (raw) => parseComparativeRankings(raw, answers.map((answer) => answer.id)),
  );

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
    const qualityPercent = rankings.find((entry) => entry.answerId === answer.id)?.qualityPercent ?? 0;
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

  emit(onProgress, { type: 'improved_generating' });
  logEvent('info', LogEvents.automationImprovedGenerating, {
    runId,
    evaluationId,
    step: 'improved',
  });

  const improvedPrompt = buildImprovedPrompt(prompt, criteria, answers, winner);
  const improved = await chatJson(
    setup.provider,
    setup.judgeModel.model,
    [
      { role: 'system', content: JUDGE_IMPROVED_SYSTEM },
      { role: 'user', content: improvedPrompt },
    ],
    { ...llmCtx, step: 'improved' },
    parseImprovedAnswer,
  );

  logEvent('info', LogEvents.automationImprovedDone, { runId, evaluationId, step: 'improved' });
  emit(onProgress, { type: 'improved_done' });

  return improved;
}

async function persistEvaluation(
  docId: ObjectId,
  set: Record<string, unknown>,
  unset: Record<string, ''> | undefined,
  errorStep: AutomationStep,
): Promise<EvaluationDocument> {
  const update: { $set: Record<string, unknown>; $unset?: Record<string, ''> } = { $set: set };

  if (unset && Object.keys(unset).length > 0) {
    update.$unset = unset;
  }

  const result = await getEvaluationsCollection().findOneAndUpdate(
    { _id: docId },
    update,
    { returnDocument: 'after' },
  );

  if (!result) {
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

function requirePromptAndCriteria(
  doc: EvaluationDocument,
): { prompt: string; criteria: RubricCriterion[] } {
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
  runId: string,
  evaluationId: string,
  onProgress: ProgressCallback,
): Promise<{ answersWithWinner: Answer[]; winner: Answer; winnerAnswerId: string }> {
  const winnerResult = pickWinner(scored);

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
  const { prompt, criteria } = requirePromptAndCriteria(doc);
  const accumulator = createTokenAccumulator(doc.tokenUsage);
  const llmCtx = createLlmCallContext(setup, runId, evaluationId, onProgress, signal, accumulator);

  const answers = await generateAnswers(
    setup,
    evaluationId,
    prompt,
    criteria,
    runId,
    onProgress,
    signal,
    llmCtx,
  );
  logAutomationStepComplete('generating', runId, evaluationId);

  const now = new Date().toISOString();
  const saved = await persistEvaluation(
    doc._id,
    { answers, updatedAt: now, ...tokenUsageField(accumulator) },
    { winnerAnswerId: '', improvedAnswer: '', automatedAt: '' },
    'generating',
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
  const { prompt, criteria } = requirePromptAndCriteria(doc);

  if (doc.answers.length === 0) {
    throw new AutomationError('Add answers before auto-scoring.', 'scoring');
  }

  const accumulator = createTokenAccumulator(doc.tokenUsage);
  const llmCtx = createLlmCallContext(setup, runId, evaluationId, onProgress, signal, accumulator);
  const scored = await scoreAnswers(
    setup,
    evaluationId,
    prompt,
    criteria,
    doc.answers,
    runId,
    onProgress,
    signal,
    llmCtx,
  );
  logAutomationStepComplete('scoring', runId, evaluationId);

  const { answersWithWinner, winnerAnswerId } = await applyWinner(scored, runId, evaluationId, onProgress);
  const now = new Date().toISOString();
  const saved = await persistEvaluation(
    doc._id,
    {
      answers: answersWithWinner,
      winnerAnswerId,
      automatedAt: now,
      updatedAt: now,
      ...tokenUsageField(accumulator),
    },
    undefined,
    'scoring',
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
  const { prompt, criteria } = requirePromptAndCriteria(doc);
  const winner = findWinnerAnswer(doc.answers, doc.winnerAnswerId);

  if (!winner) {
    throw new AutomationError('Mark a winner before generating an improved answer.', 'improved');
  }

  const accumulator = createTokenAccumulator(doc.tokenUsage);
  const llmCtx = createLlmCallContext(setup, runId, evaluationId, onProgress, signal, accumulator);
  const improvedAnswer = await synthesizeImproved(
    setup,
    evaluationId,
    prompt,
    criteria,
    doc.answers,
    winner,
    runId,
    onProgress,
    signal,
    llmCtx,
  );
  logAutomationStepComplete('improved', runId, evaluationId);

  const now = new Date().toISOString();
  const saved = await persistEvaluation(
    doc._id,
    { improvedAnswer, updatedAt: now, ...tokenUsageField(accumulator) },
    undefined,
    'improved',
  );

  return finishAutomation(saved, runId, evaluationId, onProgress);
}

async function ensureAutomationMetadata(
  doc: EvaluationDocument,
  runId: string,
  onProgress: ProgressCallback,
  signal: AbortSignal,
  accumulator: TokenAccumulator,
): Promise<EvaluationDocument> {
  if (!needsAutomationMetadataPrep(doc)) {
    return doc;
  }

  const evaluationId = doc._id.toString();
  assertNotCancelled(signal, 'generating');

  const { title, prompt } = await generateEvaluationMetadata({
    runId,
    evaluationId,
    abortSignal: signal,
    recordUsage: (usage) => {
      accumulator.add(usage);
      emit(onProgress, { type: 'token_usage', usage: accumulator.totals() });
    },
  });
  const now = new Date().toISOString();

  const saved = await persistEvaluation(
    doc._id,
    { title, prompt, updatedAt: now, ...tokenUsageField(accumulator) },
    undefined,
    'generating',
  );

  logEvent('info', LogEvents.automationPipelineStep, {
    runId,
    evaluationId,
    message: 'Title and prompt generated',
    completed: 'metadata',
    nextStep: 'generating',
  });

  emit(onProgress, { type: 'status', status: 'running', runId });

  return saved;
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
  const preparedDoc = await ensureAutomationMetadata(doc, runId, onProgress, signal, accumulator);
  const { prompt, criteria } = requirePromptAndCriteria(preparedDoc);
  const llmCtx = createLlmCallContext(setup, runId, evaluationId, onProgress, signal, accumulator);

  const answers = await generateAnswers(
    setup,
    evaluationId,
    prompt,
    criteria,
    runId,
    onProgress,
    signal,
    llmCtx,
  );
  logAutomationStepComplete('generating', runId, evaluationId);

  const scored = await scoreAnswers(
    setup,
    evaluationId,
    prompt,
    criteria,
    answers,
    runId,
    onProgress,
    signal,
    llmCtx,
  );
  logAutomationStepComplete('scoring', runId, evaluationId);

  const { answersWithWinner, winner, winnerAnswerId } = await applyWinner(
    scored,
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

  const now = new Date().toISOString();
  const saved = await persistEvaluation(
    preparedDoc._id,
    {
      answers: answersWithWinner,
      winnerAnswerId,
      improvedAnswer,
      automatedAt: now,
      updatedAt: now,
      ...tokenUsageField(accumulator),
    },
    undefined,
    'improved',
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
): Promise<EvaluationDocument> {
  const now = new Date().toISOString();

  switch (phase) {
    case 'generate': {
      if (doc.answers.length > 0 && !force) {
        throw new AutomationError(
          'Evaluation already has answers. Re-run with force=true after confirming.',
          'generating',
        );
      }

      if (force && doc.answers.length > 0) {
        const collection = getEvaluationsCollection();
        await collection.updateOne(
          { _id: doc._id },
          {
            $set: { answers: [], updatedAt: now },
            $unset: { winnerAnswerId: '', improvedAnswer: '', automatedAt: '' },
          },
        );

        return { ...doc, answers: [] };
      }

      return doc;
    }
    case 'score': {
      if (doc.answers.length === 0) {
        throw new AutomationError('Add answers before auto-scoring.', 'scoring');
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

        const collection = getEvaluationsCollection();
        await collection.updateOne(
          { _id: doc._id },
          {
            $set: { answers, updatedAt: now },
            $unset: { winnerAnswerId: '', automatedAt: '' },
          },
        );

        return { ...doc, answers, winnerAnswerId: undefined, automatedAt: undefined };
      }

      return doc;
    }
    case 'improved': {
      const winner = findWinnerAnswer(doc.answers, doc.winnerAnswerId);

      if (!winner) {
        throw new AutomationError('Mark a winner before generating an improved answer.', 'improved');
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
  const { evaluationObjectId, runId, force, onProgress } = options;
  const phase = options.phase ?? 'full';
  const collection = getEvaluationsCollection();
  const doc = await collection.findOne({ _id: evaluationObjectId });

  if (!doc) {
    throw new AutomationError('Evaluation not found.', initialFailureStep(phase));
  }

  const evaluationId = doc._id.toString();
  const signal = registerAutomationRun(evaluationId, runId);

  logEvent('info', LogEvents.automationStarted, {
    runId,
    evaluationId,
    force,
    phase,
    preset: getLlmPreset(),
  });

  let workingDoc = doc;

  try {
    if (phase === 'full') {
      if (doc.answers.length > 0 && !force) {
        throw new AutomationError(
          'Evaluation already has answers. Re-run with force=true after confirming.',
          'generating',
        );
      }

      if (force && doc.answers.length > 0) {
        await collection.updateOne(
          { _id: doc._id },
          {
            $set: {
              answers: [],
              updatedAt: new Date().toISOString(),
            },
            $unset: { winnerAnswerId: '', improvedAnswer: '', automatedAt: '' },
          },
        );
        workingDoc = { ...doc, answers: [] };
      }
    } else {
      workingDoc = await prepareDocForPhase(doc, phase, force);
    }

    let setup = await resolveProvider();

    emit(onProgress, {
      type: 'provider_resolved',
      provider: setup.providerName,
      models: [
        ...setup.answerModels.map((m) => m.label),
        setup.judgeModel.label,
      ],
    });
    logEvent('info', LogEvents.automationProviderResolved, {
      runId,
      evaluationId,
      provider: setup.providerName,
      models: setup.answerModels.map((m) => m.model).join(','),
      judge: setup.judgeModel.model,
    });

    const runPhase = () =>
      runPhaseWithSetup(setup, workingDoc, runId, onProgress, signal, phase);

    try {
      return await runPhase();
    } catch (error) {
      if (error instanceof Error && error.message.includes('429')) {
        const fallback = await resolveNextProvider(setup.providerName);

        if (fallback) {
          logEvent('warn', LogEvents.automationProviderFallback, {
            runId,
            evaluationId,
            message: `Fallback from ${setup.providerName} to ${fallback.providerName}`,
          });
          emit(onProgress, {
            type: 'provider_fallback',
            from: setup.providerName,
            to: fallback.providerName,
          });
          setup = fallback;
          return await runPhase();
        }
      }

      throw error;
    }
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

    const message = error instanceof Error ? error.message : 'Automation failed';
    const step = initialFailureStep(phase);
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
