import { Router } from 'express';

import { submitProviderChoice } from '../automation/provider-choice.js';
import { cancelAutomationRun } from '../automation/run-registry.js';
import { AutomationError, runEvaluationAutomation } from '../automation/run-evaluation.js';
import { automationStatusFromError } from '../llm/types.js';
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

  async function handleAutomateStream(
    req: import('express').Request,
    res: import('express').Response,
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
      logEvent('debug', LogEvents.sseEvent, {
        runId,
        evaluationId,
        type: (event as { type: string }).type,
      });
      writeSse(res, event);
    };

    const onClientDisconnect = () => {
      if (!res.writableFinished) {
        cancelAutomationRun(evaluationId, runId);
      }
    };

    try {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      req.on('close', onClientDisconnect);

      heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
      }, HEARTBEAT_MS);

      writeSse(res, { type: 'status', status: 'running', runId });

      timeout = setTimeout(() => {
        cancelAutomationRun(evaluationId, runId);
        writeSse(res, {
          type: 'error',
          message: 'Automation timed out',
          step: 'generating',
          status: 'failed',
        });
        res.end();
      }, AUTOMATE_TIMEOUT_MS);

      await runEvaluationAutomation({
        evaluationObjectId: objectId,
        runId,
        force,
        onProgress: (event) => onProgress(event),
      });

      if (timeout) {
        clearTimeout(timeout);
      }

      res.end();
    } catch (error) {
      if (timeout) {
        clearTimeout(timeout);
      }

      const step =
        error instanceof AutomationError ? error.step : ('generating' as const);
      const message = error instanceof Error ? error.message : 'Automation failed';

      writeSse(res, { type: 'error', message, step, status: automationStatusFromError(message) });
      res.end();
    } finally {
      if (heartbeat) {
        clearInterval(heartbeat);
      }
    }
  }

  router.get('/:id/automate/stream', (req, res, next) => {
    void handleAutomateStream(req, res).catch(next);
  });

  router.post('/:id/automate/provider-choice', (req, res) => {
    const idParam = req.params['id'];
    const evaluationIdParam = Array.isArray(idParam) ? idParam[0] : (idParam ?? '');
    const objectId = parseObjectId(evaluationIdParam);

    if (!objectId) {
      res.status(400).json({ message: 'Invalid evaluation id' });
      return;
    }

    const body = req.body as { useCloud?: boolean; runId?: string } | undefined;

    if (typeof body?.useCloud !== 'boolean') {
      res.status(400).json({ message: 'useCloud (boolean) is required.' });
      return;
    }

    if (typeof body.runId !== 'string' || body.runId.length === 0) {
      res.status(400).json({ message: 'runId (string) is required.' });
      return;
    }

    const evaluationId = objectId.toString();
    const runId = body.runId;
    const accepted = submitProviderChoice(evaluationId, runId, body.useCloud);

    if (!accepted) {
      res.status(404).json({ message: 'No provider choice is pending for this evaluation.' });
      return;
    }

    logEvent('info', LogEvents.llmSlowFallback, {
      evaluationId,
      runId,
      useCloud: body.useCloud,
    });
    res.json({ accepted: true });
  });

  router.post('/:id/automate/cancel', (req, res) => {
    const idParam = req.params['id'];
    const evaluationIdParam = Array.isArray(idParam) ? idParam[0] : (idParam ?? '');
    const objectId = parseObjectId(evaluationIdParam);

    if (!objectId) {
      res.status(400).json({ message: 'Invalid evaluation id' });
      return;
    }

    const body = req.body as { runId?: string } | undefined;

    if (typeof body?.runId !== 'string' || body.runId.length === 0) {
      res.status(400).json({ message: 'runId (string) is required.' });
      return;
    }

    const evaluationId = objectId.toString();
    const runId = body.runId;
    const cancelled = cancelAutomationRun(evaluationId, runId);

    if (!cancelled) {
      res.status(404).json({ message: 'No automation run in progress for this evaluation.' });
      return;
    }

    logEvent('info', LogEvents.automationCancelled, { evaluationId, runId });
    res.json({ cancelled: true });
  });

  return router;
}
