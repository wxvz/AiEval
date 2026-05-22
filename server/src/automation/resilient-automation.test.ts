import { ObjectId } from 'mongodb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initialScoresForCriteria } from './scores.js';
import { getActiveCriteria } from './criteria.js';
import type { EvaluationDocument } from '../types/evaluation.js';
import type { ResolvedLlmSetup } from '../llm/types.js';

const { chat, chatJson, findOne, findOneAndUpdate, updateOne, resolveProvider } = vi.hoisted(() => ({
  chat: vi.fn(),
  chatJson: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  resolveProvider: vi.fn(),
}));

vi.mock('../llm/chat.js', () => ({ chat, chatJson }));
vi.mock('../db.js', () => ({
  getEvaluationsCollection: () => ({ findOne, findOneAndUpdate, updateOne }),
}));
vi.mock('../llm/provider.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../llm/provider.js')>();

  return {
    ...actual,
    resolveProvider,
    isProviderAvailable: vi.fn().mockResolvedValue(false),
  };
});
vi.mock('./metadata.js', () => ({
  generateEvaluationMetadata: vi.fn(),
}));
vi.mock('./run-registry.js', () => ({
  registerAutomationRun: () => new AbortController().signal,
  clearAutomationRun: vi.fn(),
  isAutomationCancelled: () => false,
}));

const baseSetup: ResolvedLlmSetup = {
  providerName: 'groq',
  provider: { name: 'groq', complete: vi.fn() } as ResolvedLlmSetup['provider'],
  answerModels: [
    { model: 'model-a', label: 'A' },
    { model: 'model-b', label: 'B' },
    { model: 'model-c', label: 'C' },
  ],
  judgeModel: { model: 'judge-model', label: 'Judge' },
};

function baseDoc(overrides: Partial<EvaluationDocument> = {}): EvaluationDocument {
  return {
    _id: new ObjectId(),
    title: 'Test',
    prompt: 'Evaluate this prompt',
    criteriaMode: 'default',
    criteria: [],
    answers: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

import { runEvaluationAutomation } from './run-evaluation.js';

describe('resilient generate automation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveProvider.mockResolvedValue(baseSetup);
    chatJson.mockReset();
  });

  it('retries only the failed answer slot after partial rate limit', async () => {
    const doc = baseDoc();
    const criteria = getActiveCriteria(doc.criteriaMode, doc.criteria);
    const rateLimitError = new Error('OpenRouter request failed: 429');

    findOne.mockResolvedValue(doc);
    chat
      .mockResolvedValueOnce({ text: 'Answer one' })
      .mockResolvedValueOnce({ text: 'Answer two' })
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({ text: 'Answer three via fallback' });

    const finalAnswers = [
      {
        id: '1',
        evaluationId: doc._id.toString(),
        label: 'A',
        content: 'Answer one',
        scores: initialScoresForCriteria(criteria),
      },
      {
        id: '2',
        evaluationId: doc._id.toString(),
        label: 'B',
        content: 'Answer two',
        scores: initialScoresForCriteria(criteria),
      },
      {
        id: '3',
        evaluationId: doc._id.toString(),
        label: 'C',
        content: 'Answer three via fallback',
        scores: initialScoresForCriteria(criteria),
      },
    ];

    findOneAndUpdate.mockResolvedValue({ ...doc, answers: finalAnswers });

    const onProgress = vi.fn();

    await runEvaluationAutomation({
      evaluationObjectId: doc._id,
      runId: 'run-partial',
      force: false,
      phase: 'generate',
      onProgress,
    });

    expect(chat).toHaveBeenCalledTimes(4);
    expect(chat.mock.calls[0]?.[1]).toBe('model-a');
    expect(chat.mock.calls[1]?.[1]).toBe('model-b');
    expect(chat.mock.calls[2]?.[1]).toBe('model-c');
    expect(chat.mock.calls[3]?.[1]).not.toBe('model-a');
    expect(chat.mock.calls[3]?.[1]).not.toBe('model-b');
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'step_paused', step: 'generating', pending: 1 }),
    );
  });

  it('generate resume invokes chat only for the missing slot', async () => {
    const criteria = getActiveCriteria('default', []);
    const doc = baseDoc({
      answers: [
        {
          id: 'a1',
          evaluationId: 'eval',
          label: 'A',
          content: 'First answer',
          scores: initialScoresForCriteria(criteria),
        },
        {
          id: 'a2',
          evaluationId: 'eval',
          label: 'B',
          content: 'Second answer',
          scores: initialScoresForCriteria(criteria),
        },
      ],
    });

    findOne.mockResolvedValue(doc);
    chat.mockResolvedValue({ text: 'Third answer body' });
    findOneAndUpdate.mockResolvedValue({
      ...doc,
      answers: [
        ...doc.answers,
        {
          id: 'a3',
          evaluationId: doc._id.toString(),
          label: 'C',
          content: 'Third answer body',
          scores: initialScoresForCriteria(criteria),
        },
      ],
    });

    await runEvaluationAutomation({
      evaluationObjectId: doc._id,
      runId: 'run-resume',
      force: false,
      phase: 'generate',
      onProgress: vi.fn(),
    });

    expect(chat).toHaveBeenCalledTimes(1);
    expect(chat.mock.calls[0]?.[1]).toBe('model-c');
  });
});
