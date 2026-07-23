import type { Server } from 'node:http';

import express from 'express';
import { ObjectId } from 'mongodb';
import { afterEach, describe, expect, it, vi } from 'vitest';

const evaluationId = '507f1f77bcf86cd799439011';
const objectId = new ObjectId(evaluationId);

const { findOne, updateOne, insertOne, find, deleteOne } = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  insertOne: vi.fn(),
  find: vi.fn(),
  deleteOne: vi.fn(),
}));

vi.mock('../db.js', () => ({
  getEvaluationsCollection: () => ({
    findOne,
    updateOne,
    insertOne,
    find,
    deleteOne,
  }),
}));

vi.mock('../llm/generate-title.js', () => ({
  generateEvaluationTitle: vi.fn().mockResolvedValue('Generated Title Here'),
}));

vi.mock('../llm/generate-prompt.js', () => ({
  generateEvaluationPrompt: vi.fn().mockResolvedValue('Generated prompt text for the evaluation.'),
}));

import {
  clearAutomationRun,
  registerAutomationRun,
} from '../automation/run-registry.js';
import { generateEvaluationPrompt } from '../llm/generate-prompt.js';
import { generateEvaluationTitle } from '../llm/generate-title.js';
import {
  createEvaluationsRouter,
  resetGenerateAssistRateLimitState,
} from './evaluations.js';

async function requestEvaluations(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const app = express();
  app.use(express.json());
  app.use('/api/evaluations', createEvaluationsRouter());

  const server = await new Promise<Server>((resolve) => {
    const started = app.listen(0, () => resolve(started));
  });

  const address = server.address();

  if (!address || typeof address !== 'object') {
    throw new Error('Could not resolve test server port');
  }

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/evaluations${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (response.status === 204) {
      return { status: 204, body: null };
    }

    const responseBody = await response.json();
    return { status: response.status, body: responseBody };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function baseDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: objectId,
    title: 'Existing title',
    prompt: 'Existing prompt for the evaluation.',
    criteriaMode: 'default',
    criteria: [],
    answers: [
      {
        id: 'a1',
        evaluationId,
        label: 'Model A',
        content: 'Answer A content',
        scores: [],
      },
    ],
    winnerAnswerId: 'a1',
    improvedAnswer: { finalAnswer: 'Improved' },
    automationRunId: 'run-active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('PUT /api/evaluations/:id automation guards', () => {
  afterEach(() => {
    clearAutomationRun(evaluationId, 'run-active');
    clearAutomationRun(evaluationId, 'run-other');
    findOne.mockReset();
    updateOne.mockReset().mockResolvedValue({ modifiedCount: 1 });
  });

  it('returns 409 when overwriting answers while automation is active', async () => {
    registerAutomationRun(evaluationId, 'run-active');
    findOne.mockResolvedValue(baseDoc());

    const { status, body } = await requestEvaluations('PUT', `/${evaluationId}`, {
      ...baseDoc(),
      id: evaluationId,
      answers: [],
    });

    expect(status).toBe(409);
    expect(body).toEqual({
      message:
        'Automation is in progress. Answers, winner, and improved answer cannot be edited until it finishes.',
    });
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('allows title/prompt updates while automation is active when owned fields are unchanged', async () => {
    registerAutomationRun(evaluationId, 'run-active');
    const existing = baseDoc();
    findOne
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({ ...existing, title: 'Updated title', updatedAt: '2026-01-01T00:00:01.000Z' });

    const { status, body } = await requestEvaluations('PUT', `/${evaluationId}`, {
      id: evaluationId,
      title: 'Updated title',
      prompt: existing.prompt,
      criteriaMode: existing.criteriaMode,
      criteria: existing.criteria,
      answers: existing.answers,
      winnerAnswerId: existing.winnerAnswerId,
      improvedAnswer: existing.improvedAnswer,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    });

    expect(status).toBe(200);
    expect((body as { title: string }).title).toBe('Updated title');
    expect(updateOne).toHaveBeenCalled();
    const setDoc = updateOne.mock.calls[0]?.[1]?.$set as Record<string, unknown>;
    // Metadata-only $set — must not rewrite answers/winner/improved (TOCTOU-safe).
    expect(setDoc).toEqual({
      title: 'Updated title',
      prompt: existing.prompt,
      criteriaMode: existing.criteriaMode,
      criteria: existing.criteria,
      updatedAt: expect.any(String),
    });
    expect(setDoc).not.toHaveProperty('answers');
    expect(setDoc).not.toHaveProperty('winnerAnswerId');
    expect(setDoc).not.toHaveProperty('improvedAnswer');
  });

  it('returns 409 when deleting while automation is active', async () => {
    registerAutomationRun(evaluationId, 'run-active');

    const { status, body } = await requestEvaluations('DELETE', `/${evaluationId}`);

    expect(status).toBe(409);
    expect(body).toEqual({
      message: 'Automation is in progress. Cancel or wait before deleting this evaluation.',
    });
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it('returns 409 for stale updatedAt', async () => {
    findOne.mockResolvedValue(baseDoc({ updatedAt: '2026-01-02T00:00:00.000Z' }));

    const { status, body } = await requestEvaluations('PUT', `/${evaluationId}`, {
      id: evaluationId,
      title: 'Stale client',
      prompt: 'Existing prompt for the evaluation.',
      criteriaMode: 'default',
      criteria: [],
      answers: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(status).toBe(409);
    expect(body).toEqual({
      message: 'Evaluation was updated elsewhere. Refresh and try again.',
    });
    expect(updateOne).not.toHaveBeenCalled();
  });
});

describe('POST generate-title / generate-prompt rate limit', () => {
  afterEach(() => {
    resetGenerateAssistRateLimitState();
  });

  it('rate limits repeated generate-title requests from the same client', async () => {
    for (let i = 0; i < 20; i += 1) {
      const ok = await requestEvaluations('POST', '/generate-title', {});
      expect(ok.status).toBe(200);
    }

    const limited = await requestEvaluations('POST', '/generate-title', {});
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({
      message: 'Title generation rate limit exceeded. Try again shortly.',
    });
  });
});

describe('POST generate-title / generate-prompt next(error)', () => {
  afterEach(() => {
    resetGenerateAssistRateLimitState();
    vi.mocked(generateEvaluationTitle).mockReset().mockResolvedValue('Generated Title Here');
    vi.mocked(generateEvaluationPrompt)
      .mockReset()
      .mockResolvedValue('Generated prompt text for the evaluation.');
  });

  async function requestWithErrorMiddleware(
    method: 'POST',
    path: string,
    body?: unknown,
  ): Promise<{ status: number; body: unknown; logged: Error | undefined }> {
    let logged: Error | undefined;
    const app = express();
    app.use(express.json());
    app.use('/api/evaluations', createEvaluationsRouter());
    app.use(
      (
        error: Error,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction,
      ) => {
        logged = error;
        res.status(500).json({ message: 'Internal server error' });
      },
    );

    const server = await new Promise<Server>((resolve) => {
      const started = app.listen(0, () => resolve(started));
    });

    const address = server.address();

    if (!address || typeof address !== 'object') {
      throw new Error('Could not resolve test server port');
    }

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/evaluations${path}`, {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const responseBody = await response.json();
      return { status: response.status, body: responseBody, logged };
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  }

  it('forwards generate-title failures via next(error)', async () => {
    vi.mocked(generateEvaluationTitle).mockRejectedValueOnce(new Error('title boom'));

    const { status, body, logged } = await requestWithErrorMiddleware('POST', '/generate-title', {});

    expect(status).toBe(500);
    expect(body).toEqual({ message: 'Internal server error' });
    expect(logged?.message).toBe('title boom');
  });

  it('forwards generate-prompt failures via next(error)', async () => {
    vi.mocked(generateEvaluationPrompt).mockRejectedValueOnce(new Error('prompt boom'));

    const { status, body, logged } = await requestWithErrorMiddleware('POST', '/generate-prompt', {
      title: 'Valid title',
    });

    expect(status).toBe(500);
    expect(body).toEqual({ message: 'Internal server error' });
    expect(logged?.message).toBe('prompt boom');
  });
});
