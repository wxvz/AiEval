import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

describe('requireApiToken / isApiTokenRequired', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function loadMiddleware(apiToken: string): Promise<
    typeof import('./api-token.js')
  > {
    vi.stubEnv('AIEVAL_API_TOKEN', apiToken);
    return import('./api-token.js');
  }

  function mockRes(): Response & { statusCode: number; body: unknown } {
    const res = {
      statusCode: 200,
      body: undefined as unknown,
      status(code: number) {
        res.statusCode = code;
        return res;
      },
      json(payload: unknown) {
        res.body = payload;
        return res;
      },
    };
    return res as unknown as Response & { statusCode: number; body: unknown };
  }

  it('allows all requests when token is unset', async () => {
    const { requireApiToken, isApiTokenRequired } = await loadMiddleware('');
    const next = vi.fn() as NextFunction;
    const res = mockRes();

    requireApiToken({ headers: {}, query: {} } as Request, res, next);

    expect(isApiTokenRequired()).toBe(false);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it('returns 401 when token is set and Authorization is missing', async () => {
    const { requireApiToken, isApiTokenRequired } = await loadMiddleware('secret-token');
    const next = vi.fn() as NextFunction;
    const res = mockRes();

    requireApiToken({ headers: {}, query: {} } as Request, res, next);

    expect(isApiTokenRequired()).toBe(true);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
  });

  it('calls next when Authorization Bearer matches', async () => {
    const { requireApiToken } = await loadMiddleware('secret-token');
    const next = vi.fn() as NextFunction;
    const res = mockRes();

    requireApiToken(
      { headers: { authorization: 'Bearer secret-token' }, query: {} } as Request,
      res,
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it('returns 401 when Authorization Bearer is wrong', async () => {
    const { requireApiToken } = await loadMiddleware('secret-token');
    const next = vi.fn() as NextFunction;
    const res = mockRes();

    requireApiToken(
      { headers: { authorization: 'Bearer wrong-token' }, query: {} } as Request,
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
  });

  it('calls next when api_token query param matches', async () => {
    const { requireApiToken } = await loadMiddleware('secret-token');
    const next = vi.fn() as NextFunction;
    const res = mockRes();

    requireApiToken(
      { headers: {}, query: { api_token: 'secret-token' } } as unknown as Request,
      res,
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it('returns 401 when api_token query param is wrong', async () => {
    const { requireApiToken } = await loadMiddleware('secret-token');
    const next = vi.fn() as NextFunction;
    const res = mockRes();

    requireApiToken(
      { headers: {}, query: { api_token: 'wrong-token' } } as unknown as Request,
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
  });

  it('prefers Bearer over query when both are present', async () => {
    const { requireApiToken } = await loadMiddleware('secret-token');
    const next = vi.fn() as NextFunction;
    const res = mockRes();

    requireApiToken(
      {
        headers: { authorization: 'Bearer wrong-token' },
        query: { api_token: 'secret-token' },
      } as unknown as Request,
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
  });

  it('accepts matching Bearer when query is also present', async () => {
    const { requireApiToken } = await loadMiddleware('secret-token');
    const next = vi.fn() as NextFunction;
    const res = mockRes();

    requireApiToken(
      {
        headers: { authorization: 'Bearer secret-token' },
        query: { api_token: 'wrong-token' },
      } as unknown as Request,
      res,
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });
});
