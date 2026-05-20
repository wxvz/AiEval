import type { Server } from 'node:http';

import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config.js', () => ({
  config: {
    llmPreset: 'fast',
  },
}));

import { getEnvDefaultLlmPreset, getLlmPreset, resetLlmPresetToEnvDefault } from '../runtime-settings.js';
import { createSettingsRouter } from './settings.js';

async function requestSettings(
  method: 'GET' | 'PATCH',
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const app = express();
  app.use(express.json());
  app.use('/api/settings', createSettingsRouter());

  const server = await new Promise<Server>((resolve) => {
    const started = app.listen(0, () => resolve(started));
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Could not resolve test server port');
  }

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/settings`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const responseBody = await response.json();

    return { status: response.status, body: responseBody };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe('GET/PATCH /api/settings', () => {
  beforeEach(() => {
    resetLlmPresetToEnvDefault();
  });

  afterEach(() => {
    resetLlmPresetToEnvDefault();
  });

  it('returns current and env-default preset on GET', async () => {
    const { status, body } = await requestSettings('GET');

    expect(status).toBe(200);
    expect(body).toEqual({
      llmPreset: 'fast',
      envDefaultLlmPreset: 'fast',
    });
    expect(getEnvDefaultLlmPreset()).toBe('fast');
    expect(getLlmPreset()).toBe('fast');
  });

  it('updates llmPreset on valid PATCH', async () => {
    const { status, body } = await requestSettings('PATCH', { llmPreset: 'balanced' });

    expect(status).toBe(200);
    expect(body).toEqual({
      llmPreset: 'balanced',
      envDefaultLlmPreset: 'fast',
    });
    expect(getLlmPreset()).toBe('balanced');
  });

  it('rejects invalid preset on PATCH', async () => {
    const { status, body } = await requestSettings('PATCH', { llmPreset: 'turbo' });

    expect(status).toBe(400);
    expect((body as { message: string }).message).toContain('llmPreset');
    expect(getLlmPreset()).toBe('fast');
  });

  it('keeps envDefaultLlmPreset unchanged after PATCH', async () => {
    await requestSettings('PATCH', { llmPreset: 'balanced' });

    const { body } = await requestSettings('GET');

    expect((body as { envDefaultLlmPreset: string }).envDefaultLlmPreset).toBe('fast');
    expect(getEnvDefaultLlmPreset()).toBe('fast');
  });
});
