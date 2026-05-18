import { ObjectId } from 'mongodb';

import { config } from '../config.js';
import { getEvaluationsCollection } from '../db.js';
import { getActiveCriteria } from './criteria.js';
import {
  clampScore,
  initialScoresForCriteria,
  pickWinner,
} from './scores.js';
import { LogEvents } from '../logging/events.js';
import { logEvent } from '../logging/logger.js';
import { chat, chatJson } from '../llm/chat.js';
import {
  buildImprovedPrompt,
  buildScorePrompt,
  GENERATE_SYSTEM,
  parseImprovedAnswer,
} from '../llm/prompts.js';
import { resolveNextProvider, resolveProvider } from '../llm/provider.js';
import type {
  AutomationProgressEvent,
  AutomationStep,
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
  Score,
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

interface ScoreEntry {
  criterionId: string;
  points: number;
  notes?: string;
}

function emit(onProgress: ProgressCallback, event: AutomationProgressEvent): void {
  onProgress(event);
}

function parseScores(
  raw: unknown,
  criteria: RubricCriterion[],
  existing: Score[],
): Score[] {
  if (!raw || typeof raw !== 'object' || !('scores' in raw)) {
    throw new Error('Invalid scores JSON');
  }

  const entries = (raw as { scores: unknown }).scores;

  if (!Array.isArray(entries)) {
    throw new Error('Invalid scores array');
  }

  return criteria.map((criterion) => {
    const existingScore = existing.find((s) => s.criterionId === criterion.id);
    const match = entries.find(
      (entry): entry is ScoreEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        (entry as ScoreEntry).criterionId === criterion.id,
    );

    const points = clampScore(
      typeof match?.points === 'number' ? match.points : 0,
      criterion.maxPoints,
    );

    return {
      criterionId: criterion.id,
      criterionName: criterion.name,
      points,
      maxPoints: criterion.maxPoints,
      ...(match?.notes ? { notes: String(match.notes) } : {}),
      ...(existingScore?.notes && !match?.notes ? { notes: existingScore.notes } : {}),
    };
  });
}

async function generateAnswers(
  setup: ResolvedLlmSetup,
  evaluationId: string,
  prompt: string,
  criteria: RubricCriterion[],
  runId: string,
  onProgress: ProgressCallback,
): Promise<Answer[]> {
  const answers: Answer[] = [];
  const total = setup.answerModels.length;

  for (let index = 0; index < setup.answerModels.length; index += 1) {
    const modelRef = setup.answerModels[index];

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
    const content = await chat(
      setup.provider,
      modelRef.model,
      [
        { role: 'system', content: GENERATE_SYSTEM },
        { role: 'user', content: prompt },
      ],
      { runId, evaluationId, step: 'generating' },
    );

    const answer: Answer = {
      id: crypto.randomUUID(),
      evaluationId,
      label: modelRef.label,
      content,
      scores: initialScoresForCriteria(criteria),
    };

    answers.push(answer);

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
  }

  return answers;
}

async function scoreAnswers(
  setup: ResolvedLlmSetup,
  evaluationId: string,
  prompt: string,
  criteria: RubricCriterion[],
  answers: Answer[],
  runId: string,
  onProgress: ProgressCallback,
): Promise<Answer[]> {
  const scored: Answer[] = [];

  for (const answer of answers) {
    emit(onProgress, { type: 'scoring', answerId: answer.id, label: answer.label });
    logEvent('info', LogEvents.automationScoring, {
      runId,
      evaluationId,
      answerId: answer.id,
      step: 'scoring',
    });

    const scorePrompt = buildScorePrompt(prompt, criteria, answer);
    const scores = await chatJson(
      setup.provider,
      setup.judgeModel.model,
      [
        { role: 'system', content: 'You are a strict evaluation judge. Return JSON only.' },
        { role: 'user', content: scorePrompt },
      ],
      { runId, evaluationId, step: 'scoring' },
      (raw) => parseScores(raw, criteria, answer.scores),
    );

    const updated = { ...answer, scores };
    scored.push(updated);

    const totalPoints = scores.reduce((sum, s) => sum + s.points, 0);
    logEvent('info', LogEvents.automationScored, {
      runId,
      evaluationId,
      answerId: answer.id,
      totalPoints,
      step: 'scoring',
    });
    emit(onProgress, { type: 'scored', answerId: answer.id, totalPoints });
  }

  return scored;
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
): Promise<ImprovedAnswer> {
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
      { role: 'system', content: 'You synthesize improved answers. Return JSON only.' },
      { role: 'user', content: improvedPrompt },
    ],
    { runId, evaluationId, step: 'improved' },
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

  const answers = await generateAnswers(setup, evaluationId, prompt, criteria, runId, onProgress);
  const scored = await scoreAnswers(
    setup,
    evaluationId,
    prompt,
    criteria,
    answers,
    runId,
    onProgress,
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
  emit(onProgress, { type: 'complete', evaluation });

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

  logEvent('info', LogEvents.automationStarted, {
    runId,
    evaluationId,
    force,
    preset: config.llmPreset,
  });

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

  const freshDoc = (await collection.findOne({ _id: evaluationObjectId }))!;

  try {
    return await runWithSetup(setup, freshDoc, runId, onProgress);
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
        const retryDoc = (await collection.findOne({ _id: evaluationObjectId }))!;
        return await runWithSetup(setup, retryDoc, runId, onProgress);
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
  }
}
