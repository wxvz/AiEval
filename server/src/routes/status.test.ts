import type { Server } from 'node:http';

import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config.js', () => ({
  config: {
    dbName: 'aieval-test',
    llmPreset: 'balanced',
  },
}));

vi.mock('../db.js', () => ({
  probeMongo: vi.fn(),
}));

vi.mock('../llm/provider.js', () => ({
  probeAllProviders: vi.fn(),
  probeActiveProvider: vi.fn(),
}));

import { probeMongo } from '../db.js';
import { probeActiveProvider, probeAllProviders } from '../llm/provider.js';
import { createStatusRouter } from './status.js';

async function fetchStatus(): Promise<{ status: number; body: unknown }> {
  const app = express();
  app.use('/api/status', createStatusRouter());

  const server = await new Promise<Server>((resolve) => {
    const started = app.listen(0, () => resolve(started));
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Could not resolve test server port');
  }

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/status`);
    const body = await response.json();

    return { status: response.status, body };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe('GET /api/status', () => {
  beforeEach(() => {
    vi.mocked(probeMongo).mockReset();
    vi.mocked(probeAllProviders).mockReset();
    vi.mocked(probeActiveProvider).mockReset();
  });

  it('returns mongo, preset, providers, and active provider', async () => {
    vi.mocked(probeMongo).mockResolvedValue({ ok: true, dbName: 'aieval-test' });
    vi.mocked(probeAllProviders).mockResolvedValue([
      {
        name: 'ollama',
        status: 'ready',
        answerModels: ['llama3.2:3b'],
        judgeModel: 'llama3.2:3b',
      },
      { name: 'groq', status: 'unavailable', reason: 'API key not set' },
    ]);
    vi.mocked(probeActiveProvider).mockResolvedValue({
      name: 'ollama',
      status: 'ready',
      answerModels: ['llama3.2:3b'],
      judgeModel: 'llama3.2:3b',
    });

    const { status, body } = await fetchStatus();

    expect(status).toBe(200);
    expect(body).toEqual({
      mongo: { ok: true, dbName: 'aieval-test' },
      llmPreset: 'balanced',
      providers: [
        {
          name: 'ollama',
          status: 'ready',
          answerModels: ['llama3.2:3b'],
          judgeModel: 'llama3.2:3b',
        },
        { name: 'groq', status: 'unavailable', reason: 'API key not set' },
      ],
      activeProvider: {
        name: 'ollama',
        answerModels: ['llama3.2:3b'],
        judgeModel: 'llama3.2:3b',
      },
    });
  });

  it('reports mongo unavailable when the database probe fails', async () => {
    vi.mocked(probeMongo).mockResolvedValue({
      ok: false,
      dbName: 'aieval-test',
      reason: 'not connected',
    });
    vi.mocked(probeAllProviders).mockResolvedValue([]);
    vi.mocked(probeActiveProvider).mockResolvedValue(null);

    const { status, body } = await fetchStatus();

    expect(status).toBe(200);
    expect((body as { mongo: { ok: boolean; reason?: string } }).mongo).toEqual({
      ok: false,
      dbName: 'aieval-test',
      reason: 'not connected',
    });
  });

  it('returns null activeProvider when none are ready', async () => {
    vi.mocked(probeMongo).mockResolvedValue({ ok: true, dbName: 'aieval-test' });
    vi.mocked(probeAllProviders).mockResolvedValue([
      { name: 'ollama', status: 'unavailable', reason: 'not reachable' },
    ]);
    vi.mocked(probeActiveProvider).mockResolvedValue(null);

    const { status, body } = await fetchStatus();

    expect(status).toBe(200);
    expect((body as { activeProvider: unknown }).activeProvider).toBeNull();
  });
});
