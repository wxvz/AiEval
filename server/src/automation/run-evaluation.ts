import { ObjectId } from 'mongodb';

import { config } from '../config.js';
import { getEvaluationsCollection } from '../db.js';
import { getActiveCriteria } from './criteria.js';
import {
  allAnswersHaveEqualTotals,
  computeTotalPoints,
  initialScoresForCriteria,
  parseJudgeScoreResponse,
  pickWinner,
  scaleAnswerScores,
} from './scores.js';
import { LogEvents } from '../logging/events.js';
import { logEvent } from '../logging/logger.js';
import { chat, chatJson } from '../llm/chat.js';
import type { CompleteContext } from '../llm/rate-limit.js';
import { mapWithConcurrency } from '../util/concurrency.js';
import {
  buildComparativeRankPrompt,
  buildImprovedPrompt,
  buildScorePrompt,
  buildScorePromptContext,
  GENERATE_SYSTEM,
  JUDGE_IMPROVED_SYSTEM,
  JUDGE_RANK_SYSTEM,
  JUDGE_SCORE_SYSTEM,
  parseImprovedAnswer,
  type ScorePromptContext,
} from '../llm/prompts.js';
import { stripModelArtifacts } from '../llm/sanitize-model-output.js';
import { providerChoiceTimeoutLabel, waitForProviderChoice } from './provider-choice.js';
import {
  clearAutomationRun,
  isAutomationCancelled,
  registerAutomationRun,
} from './run-registry.js';
import { resolveNextProvider, resolveProvider } from '../llm/provider.js';
import type {
  AutomationProgressEvent,
  AutomationStep,
  ChatMessage,
  ProgressCallback,
  ResolvedLlmSetup,
} from '../llm/types.js';
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

function createLlmCallContext(
  setup: ResolvedLlmSetup,
  runId: string,
  evaluationId: string,
  onProgress: ProgressCallback,
  signal: AbortSignal,
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
  };

  return ctx;
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
    const content = await chat(setup.provider, modelRef.model, generateMessages, {
      ...llmCtx,
      step: 'generating',
    });

    const answer: Answer = {
      id: crypto.randomUUID(),
      evaluationId,
      label: modelRef.label,
      content: stripModelArtifacts(content),
      scores: initialScoresForCriteria(criteria),
    };

    logEvent('info', LogEvents.automationAnswerGenerated, {
      runId,
      evaluationId,
      provider: setup.providerName,
      model: modelRef.model,
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
  scoreContext: ScorePromptContext,
  criteria: RubricCriterion[],
  answers: Answer[],
  runId: string,
  onProgress: ProgressCallback,
  signal: AbortSignal,
  llmCtx: CompleteContext,
): Promise<Answer[]> {
  const judgeSystem: ChatMessage = {
    role: 'system',
    content: JUDGE_SCORE_SYSTEM,
  };

  const scored = await mapWithConcurrency(answers, config.llmConcurrency, async (answer) => {
    assertNotCancelled(signal, 'scoring');

    emit(onProgress, { type: 'scoring', answerId: answer.id, label: answer.label });
    logEvent('info', LogEvents.automationScoring, {
      runId,
      evaluationId,
      answerId: answer.id,
      step: 'scoring',
    });

    const judged = await chatJson(
      setup.provider,
      setup.judgeModel.model,
      [judgeSystem, { role: 'user', content: buildScorePrompt(scoreContext, answer) }],
      { ...llmCtx, step: 'scoring' },
      (raw) => parseJudgeScoreResponse(raw, criteria, answer.scores),
    );

    const totalPoints = judged.scores.reduce((sum, s) => sum + s.points, 0);
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
      ...(judged.answerNotes ? { notes: judged.answerNotes } : {}),
    });

    return {
      ...answer,
      scores: judged.scores,
      ...(judged.answerNotes ? { notes: judged.answerNotes } : {}),
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

async function runWithSetup(
  setup: ResolvedLlmSetup,
  doc: EvaluationDocument,
  runId: string,
  onProgress: ProgressCallback,
  signal: AbortSignal,
): Promise<Evaluation> {
  const evaluationId = doc._id.toString();
  const criteria = getActiveCriteria(doc.criteriaMode, doc.criteria);
  const prompt = doc.prompt;

  if (!prompt.trim()) {
    throw new AutomationError('Evaluation prompt is required.', 'generating');
  }

  if (criteria.length === 0) {
    throw new AutomationError('At least one rubric criterion is required.', 'scoring');
  }

  const scoreContext = buildScorePromptContext(prompt, criteria);
  const llmCtx = createLlmCallContext(setup, runId, evaluationId, onProgress, signal);

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
  const scored = await scoreAnswers(
    setup,
    evaluationId,
    prompt,
    scoreContext,
    criteria,
    answers,
    runId,
    onProgress,
    signal,
    llmCtx,
  );

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

  const now = new Date().toISOString();
  const update = {
    answers: answersWithWinner,
    winnerAnswerId: winnerResult.answerId,
    improvedAnswer,
    automatedAt: now,
    updatedAt: now,
  };

  const result = await getEvaluationsCollection().findOneAndUpdate(
    { _id: doc._id },
    { $set: update },
    { returnDocument: 'after' },
  );

  if (!result) {
    throw new AutomationError('Failed to save evaluation.', 'improved');
  }

  const evaluation = toApiEvaluation(result);
  logEvent('info', LogEvents.automationComplete, { runId, evaluationId, automatedAt: now });
  emit(onProgress, { type: 'complete', evaluation, status: 'completed' });

  return evaluation;
}

export async function runEvaluationAutomation(options: {
  evaluationObjectId: ObjectId;
  runId: string;
  force: boolean;
  onProgress: ProgressCallback;
}): Promise<Evaluation> {
  const { evaluationObjectId, runId, force, onProgress } = options;
  const collection = getEvaluationsCollection();
  const doc = await collection.findOne({ _id: evaluationObjectId });

  if (!doc) {
    throw new AutomationError('Evaluation not found.', 'generating');
  }

  const evaluationId = doc._id.toString();
  const signal = registerAutomationRun(evaluationId, runId);

  logEvent('info', LogEvents.automationStarted, {
    runId,
    evaluationId,
    force,
    preset: config.llmPreset,
  });

  if (doc.answers.length > 0 && !force) {
    clearAutomationRun(evaluationId, runId);
    throw new AutomationError(
      'Evaluation already has answers. Re-run with force=true after confirming.',
      'generating',
    );
  }

  let workingDoc = doc;

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

  try {
    return await runWithSetup(setup, workingDoc, runId, onProgress, signal);
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
        return await runWithSetup(setup, workingDoc, runId, onProgress, signal);
      }
    }

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
    logEvent('error', LogEvents.automationFailed, {
      runId,
      evaluationId,
      step: 'generating',
      message,
    });
    throw new AutomationError(message, 'generating');
  } finally {
    clearAutomationRun(evaluationId, runId);
  }
}
