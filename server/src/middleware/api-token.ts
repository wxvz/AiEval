import { timingSafeEqual } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import { config } from '../config.js';

export function isApiTokenRequired(): boolean {
  return !!config.apiToken;
}

function tokensEqual(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);

  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(providedBuf, expectedBuf);
}

function bearerTokenMatches(header: string | undefined, expected: string): boolean {
  if (!header?.startsWith('Bearer ')) {
    return false;
  }

  const provided = header.slice('Bearer '.length).trim();
  return tokensEqual(provided, expected);
}

function queryTokenMatches(query: Request['query'], expected: string): boolean {
  const raw = query['api_token'];
  const provided = typeof raw === 'string' ? raw.trim() : '';

  if (!provided) {
    return false;
  }

  return tokensEqual(provided, expected);
}

export function requireApiToken(req: Request, res: Response, next: NextFunction): void {
  if (!config.apiToken) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  // Prefer Bearer when present (EventSource uses ?api_token= instead).
  if (authHeader?.startsWith('Bearer ')) {
    if (bearerTokenMatches(authHeader, config.apiToken)) {
      next();
      return;
    }

    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  if (queryTokenMatches(req.query, config.apiToken)) {
    next();
    return;
  }

  res.status(401).json({ message: 'Unauthorized' });
}
