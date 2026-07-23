import { ObjectId } from 'mongodb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getActiveCriteria } from './criteria.js';
import { initialScoresForCriteria } from './scores.js';
import type { EvaluationDocument } from '../types/evaluation.js';
import { DEFAULT_EVALUATION_CONFIG } from '../evaluation-config.js';
import {
  AUTOMATION_METADATA_STUB_PROMPT,
  AUTOMATION_METADATA_STUB_TITLE,
} from './constants.js';

const {
  updateOne,
  findOne,
  findOneAndUpdate,
  resolveProvider,
  chatJson,
  generateEvaluationMetadata,
} = vi.hoisted(() => ({
  updateOne: vi.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  resolveProvider: vi.fn(),
  chatJson: vi.fn(),
  generateEvaluationMetadata: vi.fn(),
}));

vi.mock('../db.js', () => ({
  getEvaluationsCollection: () => ({ updateOne, findOne, findOneAndUpdate }),
}));
vi.mock('../llm/provider.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../llm/provider.js')>();

  return {
    ...actual,
    resolveProvider,
    isProviderAvailable: vi.fn().mockResolvedValue(false),
  };
});
vi.mock('../llm/chat.js', () => ({
  chat: vi.fn(),
  chatJson,
  createLlmCallContext: vi.fn(() => ({})),
}));
vi.mock('./metadata.js', () => ({
  generateEvaluationMetadata,
}));

import { AutomationError, prepareDocForPhase, runEvaluationAutomation } from './run-evaluation.js';
import {
  cancelAutomationRun,
  clearAutomationRun,
  registerAutomationRun,
} from './run-registry.js';

const mockSetup = {
  providerName: 'groq' as const,
  provider: { name: 'groq' as const, complete: vi.fn() },
  answerModels: [
    { model: 'm1', label: 'M1' },
    { model: 'm2', label: 'M2' },
    { model: 'm3', label: 'M3' },
  ],
  judgeModel: { model: 'judge', label: 'Judge' },
  preset: 'balanced' as const,
};

function baseDoc(overrides: Partial<EvaluationDocument> = {}): EvaluationDocument {
  return {
    _id: new ObjectId(),
    title: 'Test',
    prompt: 'Hello',
    criteriaMode: 'default',
    criteria: [],
    evaluationConfig: DEFAULT_EVALUATION_CONFIG,
    answers: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('prepareDocForPhase', () => {
  beforeEach(() => {
    updateOne.mockClear();
    resolveProvider.mockResolvedValue(mockSetup);
  });

  it('allows generate resume when fewer answers than expected models', async () => {
    const doc = baseDoc();
    const criteria = getActiveCriteria(doc.criteriaMode, doc.criteria);
    const docWithPartial = baseDoc({
      answers: [
        {
          id: 'a1',
          evaluationId: 'eval',
          label: 'M1',
          content: 'Hi',
          scores: initialScoresForCriteria(criteria),
        },
      ],
    });

    const result = await prepareDocForPhase(docWithPartial, 'generate', false);

    expect(result.answers).toHaveLength(1);
  });

  it('throws for generate when all answer slots are filled without force', async () => {
    const doc = baseDoc({
      answers: [
        { id: 'a1', evaluationId: 'eval', label: 'M1', content: 'One', scores: [] },
        { id: 'a2', evaluationId: 'eval', label: 'M2', content: 'Two', scores: [] },
        { id: 'a3', evaluationId: 'eval', label: 'M3', content: 'Three', scores: [] },
      ],
    });

    await expect(prepareDocForPhase(doc, 'generate', false)).rejects.toThrow(AutomationError);
  });

  it('throws for score when there are no answers', async () => {
    await expect(prepareDocForPhase(baseDoc(), 'score', false)).rejects.toThrow(AutomationError);
  });

  it('throws for score when answers are incomplete', async () => {
    const doc = baseDoc({
      answers: [
        {
          id: 'a1',
          evaluationId: 'eval',
          label: 'M1',
          content: 'Hi',
          scores: [],
        },
      ],
    });

    await expect(prepareDocForPhase(doc, 'score', false)).rejects.toThrow(
      /Need all 3 model answers before scoring/i,
    );
  });

  it('throws for score when already scored without force', async () => {
    const doc = baseDoc({
      automatedAt: '2020-01-01T00:00:00.000Z',
      answers: [
        {
          id: 'a1',
          evaluationId: 'eval',
          label: 'M1',
          content: 'Hi',
          scores: [],
        },
        {
          id: 'a2',
          evaluationId: 'eval',
          label: 'M2',
          content: 'Hi 2',
          scores: [],
        },
        {
          id: 'a3',
          evaluationId: 'eval',
          label: 'M3',
          content: 'Hi 3',
          scores: [],
        },
      ],
    });

    await expect(prepareDocForPhase(doc, 'score', false)).rejects.toThrow(AutomationError);
  });

  it('clears stale improved output when scoring with force', async () => {
    const doc = baseDoc({
      automatedAt: '2020-01-01T00:00:00.000Z',
      winnerAnswerId: 'a1',
      improvedAnswer: { finalAnswer: 'Stale answer' },
      answers: [
        {
          id: 'a1',
          evaluationId: 'eval',
          label: 'M1',
          content: 'Hi',
          scores: [],
          isWinner: true,
        },
        {
          id: 'a2',
          evaluationId: 'eval',
          label: 'M2',
          content: 'Hi 2',
          scores: [],
        },
        {
          id: 'a3',
          evaluationId: 'eval',
          label: 'M3',
          content: 'Hi 3',
          scores: [],
        },
      ],
    });

    const result = await prepareDocForPhase(doc, 'score', true);

    expect(result.improvedAnswer).toBeUndefined();
    expect(updateOne).toHaveBeenCalledWith(
      { _id: doc._id },
      expect.objectContaining({
        $unset: expect.objectContaining({ improvedAnswer: '' }),
      }),
    );
  });

  it('throws for improved when there is no winner', async () => {
    await expect(prepareDocForPhase(baseDoc(), 'improved', false)).rejects.toThrow(AutomationError);
  });

  it('throws for improved when improved answer exists without force', async () => {
    const doc = baseDoc({
      winnerAnswerId: 'a1',
      improvedAnswer: { finalAnswer: 'Better answer' },
      answers: [
        {
          id: 'a1',
          evaluationId: 'eval',
          label: 'M1',
          content: 'Hi',
          scores: [],
          isWinner: true,
        },
      ],
    });

    await expect(prepareDocForPhase(doc, 'improved', false)).rejects.toThrow(AutomationError);
  });

  it('clears answers on generate force', async () => {
    const doc = baseDoc({
      winnerAnswerId: 'a1',
      answers: [
        {
          id: 'a1',
          evaluationId: 'eval',
          label: 'M1',
          content: 'Hi',
          scores: [],
        },
      ],
    });

    const result = await prepareDocForPhase(doc, 'generate', true);

    expect(updateOne).toHaveBeenCalled();
    expect(result.answers).toEqual([]);
  });

  it('unsets improvedAnswer on score force', async () => {
    const doc = baseDoc({
      winnerAnswerId: 'a1',
      automatedAt: '2020-01-01T00:00:00.000Z',
      improvedAnswer: { finalAnswer: 'Stale improved' },
      answers: [
        {
          id: 'a1',
          evaluationId: 'eval',
          label: 'M1',
          content: 'Hi',
          scores: [],
          isWinner: true,
        },
        {
          id: 'a2',
          evaluationId: 'eval',
          label: 'M2',
          content: 'Hi 2',
          scores: [],
        },
        {
          id: 'a3',
          evaluationId: 'eval',
          label: 'M3',
          content: 'Hi 3',
          scores: [],
        },
      ],
    });

    const result = await prepareDocForPhase(doc, 'score', true);

    expect(updateOne).toHaveBeenCalledWith(
      { _id: doc._id },
      expect.objectContaining({
        $unset: { winnerAnswerId: '', automatedAt: '', improvedAnswer: '' },
      }),
    );
    expect(result.improvedAnswer).toBeUndefined();
    expect(result.winnerAnswerId).toBeUndefined();
    expect(result.answers[0]?.isWinner).toBe(false);
  });

  it('filters generate force clear by automationRunId when gate is set', async () => {
    const doc = baseDoc({
      automationRunId: 'run-owned',
      answers: [
        {
          id: 'a1',
          evaluationId: 'eval',
          label: 'M1',
          content: 'Hi',
          scores: [],
        },
      ],
    });
    const evaluationId = doc._id.toString();
    const runId = 'run-owned';
    const signal = registerAutomationRun(evaluationId, runId);

    await prepareDocForPhase(doc, 'generate', true, { evaluationId, runId, signal });

    expect(updateOne).toHaveBeenCalledWith(
      { _id: doc._id, automationRunId: runId },
      expect.objectContaining({
        $set: expect.objectContaining({ answers: [] }),
      }),
    );

    clearAutomationRun(evaluationId, runId);
  });

  it('filters score force clear by automationRunId when gate is set', async () => {
    const doc = baseDoc({
      automationRunId: 'run-score',
      winnerAnswerId: 'a1',
      automatedAt: '2020-01-01T00:00:00.000Z',
      answers: [
        {
          id: 'a1',
          evaluationId: 'eval',
          label: 'M1',
          content: 'Hi',
          scores: [],
          isWinner: true,
        },
        {
          id: 'a2',
          evaluationId: 'eval',
          label: 'M2',
          content: 'Hi 2',
          scores: [],
        },
        {
          id: 'a3',
          evaluationId: 'eval',
          label: 'M3',
          content: 'Hi 3',
          scores: [],
        },
      ],
    });
    const evaluationId = doc._id.toString();
    const runId = 'run-score';
    const signal = registerAutomationRun(evaluationId, runId);

    await prepareDocForPhase(doc, 'score', true, { evaluationId, runId, signal });

    expect(updateOne).toHaveBeenCalledWith(
      { _id: doc._id, automationRunId: runId },
      expect.objectContaining({
        $unset: { winnerAnswerId: '', automatedAt: '', improvedAnswer: '' },
      }),
    );

    clearAutomationRun(evaluationId, runId);
  });
});

describe('runImprovedPhase metadata prep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveProvider.mockResolvedValue(mockSetup);
    updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
  });

  it('calls generateEvaluationMetadata when improved runs against stub title/prompt', async () => {
    const criteria = getActiveCriteria('default', []);
    const scores = initialScoresForCriteria(criteria);
    const runId = 'run-improved-meta';
    const doc = baseDoc({
      title: AUTOMATION_METADATA_STUB_TITLE,
      prompt: AUTOMATION_METADATA_STUB_PROMPT,
      winnerAnswerId: 'a1',
      answers: [
        {
          id: 'a1',
          evaluationId: 'eval',
          label: 'M1',
          content: 'Winner content',
          scores,
          isWinner: true,
        },
      ],
    });
    const evaluationId = doc._id.toString();

    generateEvaluationMetadata.mockResolvedValue({
      title: 'Generated title',
      prompt: 'Generated prompt for the improved phase.',
    });
    chatJson.mockResolvedValue({
      analysis: 'Analysis',
      finalAnswer: 'Improved final',
      notes: 'Notes',
    });

    findOne.mockResolvedValue(doc);
    findOneAndUpdate
      .mockResolvedValueOnce({
        ...doc,
        title: 'Generated title',
        prompt: 'Generated prompt for the improved phase.',
        automationRunId: runId,
      })
      .mockResolvedValueOnce({
        ...doc,
        title: 'Generated title',
        prompt: 'Generated prompt for the improved phase.',
        improvedAnswer: {
          analysis: 'Analysis',
          finalAnswer: 'Improved final',
          notes: 'Notes',
        },
        automationRunId: runId,
      });

    try {
      const result = await runEvaluationAutomation({
        evaluationObjectId: doc._id,
        runId,
        force: false,
        phase: 'improved',
        onProgress: () => undefined,
      });

      expect(generateEvaluationMetadata).toHaveBeenCalled();
      expect(result.improvedAnswer?.finalAnswer).toBe('Improved final');
      expect(result.title).toBe('Generated title');
    } finally {
      cancelAutomationRun(evaluationId, runId);
      clearAutomationRun(evaluationId, runId);
    }
  });
});
