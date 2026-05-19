import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

describe('requestLogger', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('LOG_LEVEL', 'info');
    vi.stubEnv('LOG_FORMAT', 'json');
    vi.stubEnv('LOG_FILE', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('logs cached evaluation list GETs at debug', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const { requestLogger } = await import('./request-logger.js');

    const req = {
      method: 'GET',
      path: '/api/evaluations',
      originalUrl: '/api/evaluations',
    } as Request;

    const res = new EventEmitter() as Response & EventEmitter;
    res.statusCode = 304;

    requestLogger(req, res as Response, () => {
      res.emit('finish');
    });

    const output = write.mock.calls.map((call) => String(call[0])).join('');
    expect(output).not.toContain('"event":"http.request"');
  });

  it('logs automation routes at info', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const { requestLogger } = await import('./request-logger.js');

    const req = {
      method: 'GET',
      path: '/api/evaluations/eval-1/automate/stream',
      originalUrl: '/api/evaluations/eval-1/automate/stream',
    } as Request;

    const res = new EventEmitter() as Response & EventEmitter;
    res.statusCode = 200;

    requestLogger(req, res as Response, () => {
      res.emit('finish');
    });

    const output = write.mock.calls.map((call) => String(call[0])).join('');
    expect(output).toContain('"event":"http.request"');
    expect(output).toContain('automate/stream');
  });
});
