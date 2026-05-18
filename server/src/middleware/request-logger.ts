import type { NextFunction, Request, Response } from 'express';

import { LogEvents } from '../logging/events.js';
import { logEvent } from '../logging/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    logEvent('info', LogEvents.httpRequest, {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
}
