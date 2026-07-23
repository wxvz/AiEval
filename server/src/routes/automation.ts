import { Router } from 'express';

import { submitProviderChoice } from '../automation/provider-choice.js';
import { cancelAutomationRun, getActiveAutomationRunId } from '../automation/run-registry.js';
import {
  AutomationError,
  runEvaluationAutomation,
  type AutomationPhase,
} from '../automation/run-evaluation.js';
import { resolveFirstCloudProvider } from '../llm/provider.js';
import { automationStatusFromError, type AutomationStep } from '../llm/types.js';
import { LogEvents } from '../logging/events.js';
import { logEvent } from '../logging/logger.js';
import { parseObjectId } from '../serialization.js';

const HEARTBEAT_MS = 15_000;
const AUTOMATE_TIMEOUT_MS = 10 * 60 * 1000;

function parseForce(value: unknown): boolean {
  const raw = Array.isArray(value) ? value[0] : value;

  return raw === 'true' || raw === '1' || raw === true;
}

/** `null` = omitted/empty (treat as full). Throws for unrecognized values. */
export function parsePhase(value: unknown): AutomationPhase {
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw === undefined || raw === null || raw === '') {
    return 'full';
  }

  if (raw === 'generate' || raw === 'score' || raw === 'improved' || raw === 'full') {
    return raw;
  }

  throw new Error(
    `Invalid phase "${String(raw)}". Use generate, score, improved, or full.`,
  );
}

function initialStepForPhase(phase: AutomationPhase): AutomationStep {
  switch (phase) {
    case 'score':
      return 'scoring';
    case 'improved':
      return 'improved';
    case 'generate':
    case 'full':
      return 'generating';
  }
}

function stepFromProgressEvent(
  event: { type: string; step?: AutomationStep },
  fallback: AutomationStep,
): AutomationStep {
  if (
    event.step === 'generating' ||
    event.step === 'scoring' ||
    event.step === 'improved' ||
    event.step === 'provider'
  ) {
    return event.step;
  }

  switch (event.type) {
    case 'generating':
    case 'answer_generated':
    case 'metadata_generated':
      return 'generating';
    case 'scoring_batch':
    case 'scoring':
    case 'scored':
    case 'winner_picked':
      return 'scoring';
    case 'improved_generating':
    case 'improved_done':
      return 'improved';
    case 'provider_resolved':
    case 'provider_fallback':
    case 'slow_provider_prompt':
      return 'provider';
    default:
      return fallback;
  }
}

function isStreamClosed(res: import('express').Response): boolean {
  return res.writableEnded || res.writableFinished;
}

function writeSse(res: import('express').Response, data: unknown): void {
  if (isStreamClosed(res)) {
    return;
  }

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

    let phase: AutomationPhase;

    try {
      phase = parsePhase(req.query['phase']);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid phase';
      res.status(400).json({ message });
      return;
    }

    const runId = crypto.randomUUID();
    const force = parseForce(req.query['force']);
    const evaluationId = objectId.toString();
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let timeoutDeadline = 0;
    let remainingAutomateMs = AUTOMATE_TIMEOUT_MS;
    let pausedForProviderChoice = false;
    let currentStep: AutomationStep = initialStepForPhase(phase);

    const clearAutomateTimeout = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }
    };

    const armAutomateTimeout = (ms: number) => {
      clearAutomateTimeout();
      remainingAutomateMs = ms;
      timeoutDeadline = Date.now() + ms;
      timeout = setTimeout(() => {
        cancelAutomationRun(evaluationId, runId);
        writeSse(res, {
          type: 'error',
          message: 'Automation timed out',
          step: currentStep,
          status: 'failed',
        });
        res.end();
      }, ms);
    };

    const onProgress = (event: Parameters<typeof writeSse>[1]) => {
      const progress = event as { type: string; status?: string; step?: AutomationStep };

      currentStep = stepFromProgressEvent(progress, currentStep);
      logEvent('debug', LogEvents.sseEvent, {
        runId,
        evaluationId,
        type: progress.type,
      });

      // Pause the 10m wall-clock while the user answers the slow-provider prompt
      // so CHOICE_TIMEOUT_MS (30m) is actually reachable.
      if (progress.type === 'slow_provider_prompt') {
        if (timeout) {
          remainingAutomateMs = Math.max(0, timeoutDeadline - Date.now());
          clearAutomateTimeout();
        }

        pausedForProviderChoice = true;
      }

      if (
        progress.type === 'status' &&
        progress.status === 'running' &&
        pausedForProviderChoice
      ) {
        pausedForProviderChoice = false;
        armAutomateTimeout(
          remainingAutomateMs > 0 ? remainingAutomateMs : AUTOMATE_TIMEOUT_MS,
        );
      }

      writeSse(res, event);
    };

    const onClientDisconnect = () => {
      // Only cancel if this run is still active — after clearAutomationRun, a late
      // close must not record an orphan pending cancel for the finished runId.
      if (!res.writableFinished && getActiveAutomationRunId(evaluationId) === runId) {
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
        if (isStreamClosed(res)) {
          return;
        }

        res.write(': heartbeat\n\n');
      }, HEARTBEAT_MS);

      writeSse(res, { type: 'status', status: 'running', runId });
      armAutomateTimeout(AUTOMATE_TIMEOUT_MS);

      await runEvaluationAutomation({
        evaluationObjectId: objectId,
        runId,
        force,
        phase,
        onProgress: (event) => onProgress(event),
      });

      clearAutomateTimeout();
      res.end();
    } catch (error) {
      clearAutomateTimeout();

      const step = error instanceof AutomationError ? error.step : currentStep;
      const message = error instanceof Error ? error.message : 'Automation failed';

      writeSse(res, { type: 'error', message, step, status: automationStatusFromError(message) });
      res.end();
    } finally {
      req.off('close', onClientDisconnect);
      if (heartbeat) {
        clearInterval(heartbeat);
      }
    }
  }

  router.get('/:id/automate/stream', (req, res, next) => {
    void handleAutomateStream(req, res).catch(next);
  });

  router.post('/:id/automate/provider-choice', (req, res, next) => {
    void (async () => {
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

      if (body.useCloud) {
        const cloud = await resolveFirstCloudProvider();

        if (!cloud) {
          res.status(400).json({
            message:
              'No cloud LLM provider configured. Set GROQ_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY, or HUGGINGFACE_API_KEY.',
          });
          return;
        }
      }

      const evaluationId = objectId.toString();
      const runId = body.runId;
      const result = submitProviderChoice(evaluationId, runId, body.useCloud);

      if (!result.ok) {
        if (result.reason === 'run_mismatch') {
          res.status(409).json({
            message: 'runId does not match the pending provider choice for this evaluation.',
          });
          return;
        }

        res.status(404).json({
          message:
            'No provider choice is pending for this evaluation. It may have already been answered, timed out, or the server restarted.',
        });
        return;
      }

      logEvent('info', LogEvents.automationProviderChoice, {
        evaluationId,
        runId,
        useCloud: body.useCloud,
      });
      res.json({ accepted: true });
    })().catch(next);
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
