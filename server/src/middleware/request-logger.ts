import type { NextFunction, Request, Response } from 'express';

import { LogEvents } from '../logging/events.js';
import { logEvent } from '../logging/logger.js';

const SENSITIVE_QUERY_KEYS = new Set(['api_token', 'authorization']);

/** Redact secrets from paths before logging (EventSource uses ?api_token=). */
export function redactLoggedRequestPath(originalUrl: string): string {
  const queryIndex = originalUrl.indexOf('?');

  if (queryIndex === -1) {
    return originalUrl;
  }

  const pathname = originalUrl.slice(0, queryIndex);
  const search = originalUrl.slice(queryIndex + 1);
  const params = new URLSearchParams(search);
  let redacted = false;

  for (const key of [...params.keys()]) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      params.set(key, '[REDACTED]');
      redacted = true;
    }
  }

  if (!redacted) {
    return originalUrl;
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function httpRequestLogLevel(req: Request, status: number): 'debug' | 'info' {
  // Express ETag caching on unchanged list responses — not LLM activity.
  if (req.method === 'GET' && req.path === '/api/evaluations' && status === 304) {
    return 'debug';
  }

  return 'info';
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const level = httpRequestLogLevel(req, res.statusCode);
    logEvent(level, LogEvents.httpRequest, {
      method: req.method,
      // Never log Authorization headers; redact api_token / authorization query params.
      path: redactLoggedRequestPath(req.originalUrl),
      status: res.statusCode,
      durationMs: Date.now() - start,
      ...(level === 'debug' && res.statusCode === 304
        ? { hint: 'cached evaluation list; not an LLM call' }
        : {}),
    });
  });

  next();
}
