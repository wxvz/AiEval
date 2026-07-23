import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

import { redactLoggedRequestPath } from './request-logger.js';

describe('redactLoggedRequestPath', () => {
  it('redacts api_token query values', () => {
    expect(
      redactLoggedRequestPath(
        '/api/evaluations/eval-1/automate/stream?phase=generate&api_token=super-secret',
      ),
    ).toBe(
      '/api/evaluations/eval-1/automate/stream?phase=generate&api_token=%5BREDACTED%5D',
    );
  });

  it('redacts authorization query values case-insensitively', () => {
    expect(redactLoggedRequestPath('/api/foo?Authorization=Bearer%20secret')).toBe(
      '/api/foo?Authorization=%5BREDACTED%5D',
    );
  });

  it('leaves paths without sensitive query keys unchanged', () => {
    expect(redactLoggedRequestPath('/api/evaluations?force=true')).toBe(
      '/api/evaluations?force=true',
    );
    expect(redactLoggedRequestPath('/api/evaluations')).toBe('/api/evaluations');
  });
});

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

  it('redacts api_token from logged path', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const { requestLogger } = await import('./request-logger.js');

    const req = {
      method: 'GET',
      path: '/api/evaluations/eval-1/automate/stream',
      originalUrl:
        '/api/evaluations/eval-1/automate/stream?api_token=browser-secret&phase=generate',
    } as Request;

    const res = new EventEmitter() as Response & EventEmitter;
    res.statusCode = 200;

    requestLogger(req, res as Response, () => {
      res.emit('finish');
    });

    const output = write.mock.calls.map((call) => String(call[0])).join('');
    expect(output).toContain('"event":"http.request"');
    expect(output).toContain('api_token=%5BREDACTED%5D');
    expect(output).not.toContain('browser-secret');
  });
});
