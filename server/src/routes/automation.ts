import { Router } from 'express';

import { AutomationError, runEvaluationAutomation } from '../automation/run-evaluation.js';
import { LogEvents } from '../logging/events.js';
import { logEvent } from '../logging/logger.js';
import { parseObjectId } from '../serialization.js';

const HEARTBEAT_MS = 15_000;
const AUTOMATE_TIMEOUT_MS = 10 * 60 * 1000;

function parseForce(value: unknown): boolean {
  const raw = Array.isArray(value) ? value[0] : value;

  return raw === 'true' || raw === '1' || raw === true;
}

function writeSse(res: import('express').Response, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function createAutomationRouter(): Router {
  const router = Router({ mergeParams: true });

  async function handleAutomate(
    req: import('express').Request,
    res: import('express').Response,
    stream: boolean,
  ): Promise<void> {
    const idParam = req.params['id'];
    const evaluationIdParam = Array.isArray(idParam) ? idParam[0] : (idParam ?? '');
    const objectId = parseObjectId(evaluationIdParam);

    if (!objectId) {
      res.status(400).json({ message: 'Invalid evaluation id' });
      return;
    }

    const runId = crypto.randomUUID();
    const force = parseForce(req.query['force']);
    const evaluationId = objectId.toString();
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const onProgress = (event: Parameters<typeof writeSse>[1]) => {
      if (stream) {
        logEvent('debug', LogEvents.sseEvent, { runId, evaluationId, type: (event as { type: string }).type });
        writeSse(res, event);
      }
    };

    try {
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();

        heartbeat = setInterval(() => {
          res.write(': heartbeat\n\n');
        }, HEARTBEAT_MS);

        timeout = setTimeout(() => {
          writeSse(res, { type: 'error', message: 'Automation timed out', step: 'generating' });
          res.end();
        }, AUTOMATE_TIMEOUT_MS);
      }

      const evaluation = await runEvaluationAutomation({
        evaluationObjectId: objectId,
        runId,
        force,
        onProgress: (event) => onProgress(event),
      });

      if (timeout) {
        clearTimeout(timeout);
      }

      if (stream) {
        res.end();
        return;
      }

      res.json(evaluation);
    } catch (error) {
      if (timeout) {
        clearTimeout(timeout);
      }

      const step =
        error instanceof AutomationError ? error.step : ('generating' as const);
      const message = error instanceof Error ? error.message : 'Automation failed';
      const status = message.includes('not found')
        ? 404
        : message.includes('force=true')
          ? 409
          : message.includes('No LLM provider')
            ? 503
            : 502;

      if (stream) {
        writeSse(res, { type: 'error', message, step });
        res.end();
        return;
      }

      res.status(status).json({ message, step });
    } finally {
      if (heartbeat) {
        clearInterval(heartbeat);
      }
    }
  }

  router.post('/:id/automate', (req, res, next) => {
    void handleAutomate(req, res, false).catch(next);
  });

  router.get('/:id/automate/stream', (req, res, next) => {
    void handleAutomate(req, res, true).catch(next);
  });

  return router;
}
