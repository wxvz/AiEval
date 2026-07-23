import type { Server } from 'node:http';

import express from 'express';
import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';

import { createAutomationRouter, parsePhase } from './automation.js';

describe('parsePhase', () => {
  it('defaults omitted or empty values to full', () => {
    expect(parsePhase(undefined)).toBe('full');
    expect(parsePhase(null)).toBe('full');
    expect(parsePhase('')).toBe('full');
  });

  it('accepts known phases', () => {
    expect(parsePhase('generate')).toBe('generate');
    expect(parsePhase('score')).toBe('score');
    expect(parsePhase('improved')).toBe('improved');
    expect(parsePhase('full')).toBe('full');
    expect(parsePhase(['generate'])).toBe('generate');
  });

  it('throws for invalid phase values', () => {
    expect(() => parsePhase('bogus')).toThrow(/Invalid phase/);
    expect(() => parsePhase('FULL')).toThrow(/Invalid phase/);
  });
});

describe('GET /:id/automate/stream phase query', () => {
  const evaluationId = '507f1f77bcf86cd799439011';

  async function requestStream(phaseQuery: string): Promise<{ status: number; body: unknown }> {
    const app = express();
    app.use('/api/evaluations', createAutomationRouter());

    const server = await new Promise<Server>((resolve) => {
      const started = app.listen(0, () => resolve(started));
    });

    const address = server.address();

    if (!address || typeof address !== 'object') {
      throw new Error('Could not resolve test server port');
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/evaluations/${evaluationId}/automate/stream?${phaseQuery}`,
      );

      const contentType = response.headers.get('content-type') ?? '';
      const body = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

      return { status: response.status, body };
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  }

  it('returns 400 for an invalid phase (does not coerce to full)', async () => {
    expect(ObjectId.isValid(evaluationId)).toBe(true);

    const { status, body } = await requestStream('phase=bogus');

    expect(status).toBe(400);
    expect(body).toEqual({
      message: 'Invalid phase "bogus". Use generate, score, improved, or full.',
    });
  });
});
