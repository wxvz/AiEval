import type { NextFunction, Request, Response } from 'express';

import { LogEvents } from '../logging/events.js';
import { logEvent } from '../logging/logger.js';

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
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
      ...(level === 'debug' && res.statusCode === 304
        ? { hint: 'cached evaluation list; not an LLM call' }
        : {}),
    });
  });

  next();
}
