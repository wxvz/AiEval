import { Router, type Request } from 'express';

import { getActiveAutomationRunId } from '../automation/run-registry.js';
import { generateEvaluationPrompt } from '../llm/generate-prompt.js';
import { generateEvaluationTitle } from '../llm/generate-title.js';
import { getEvaluationsCollection } from '../db.js';
import { estimateEvaluationRun } from '../evaluation-estimate.js';
import { normalizeEvaluationConfig } from '../evaluation-config.js';
import {
  normalizeEvaluationRecord,
  parseObjectId,
  toApiEvaluation,
} from '../serialization.js';
import type { Evaluation, EvaluationDocument, EvaluationRecord } from '../types/evaluation.js';

const GENERATE_RATE_LIMIT_WINDOW_MS = 60_000;
const GENERATE_RATE_LIMIT_MAX_PER_MINUTE = 20;
const GENERATE_RATE_LIMIT_MAX_KEYS = 2_000;
const generateRateLimitHits = new Map<string, number[]>();

/** Test helper — clears the in-memory generate-assist rate-limit window. */
export function resetGenerateAssistRateLimitState(): void {
  generateRateLimitHits.clear();
}

function clientGenerateRateKey(req: Request): string {
  // Do not trust X-Forwarded-For without Express `trust proxy` — clients can spoof it.
  const ip = String(req.ip || req.socket.remoteAddress || '').trim();
  return ip ? `ip:${ip}` : 'ip:unknown';
}

function pruneGenerateRateLimitHits(now: number): void {
  for (const [key, stamps] of generateRateLimitHits) {
    const recent = stamps.filter((stamp) => now - stamp < GENERATE_RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) {
      generateRateLimitHits.delete(key);
    } else if (recent.length !== stamps.length) {
      generateRateLimitHits.set(key, recent);
    }
  }

  if (generateRateLimitHits.size > GENERATE_RATE_LIMIT_MAX_KEYS) {
    const overflow = generateRateLimitHits.size - GENERATE_RATE_LIMIT_MAX_KEYS;
    let removed = 0;
    for (const key of generateRateLimitHits.keys()) {
      generateRateLimitHits.delete(key);
      removed += 1;
      if (removed >= overflow) {
        break;
      }
    }
  }
}

function checkGenerateRateLimit(key: string): boolean {
  const now = Date.now();
  pruneGenerateRateLimitHits(now);
  const recent = (generateRateLimitHits.get(key) ?? []).filter(
    (stamp) => now - stamp < GENERATE_RATE_LIMIT_WINDOW_MS,
  );
  if (recent.length >= GENERATE_RATE_LIMIT_MAX_PER_MINUTE) {
    generateRateLimitHits.set(key, recent);
    return false;
  }
  recent.push(now);
  generateRateLimitHits.set(key, recent);
  return true;
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** True when an automation run is active for this evaluation in the process registry. */
export function isEvaluationAutomationActive(evaluationId: string): boolean {
  return getActiveAutomationRunId(evaluationId) !== undefined;
}

/**
 * Client PUTs send the full evaluation; treat answers / winner / improved as mutations
 * only when the payload would change stored automation-owned fields.
 */
export function wouldOverwriteAutomationOwnedFields(
  body: Partial<Evaluation>,
  existing: Pick<EvaluationDocument, 'answers' | 'winnerAnswerId' | 'improvedAnswer'>,
): boolean {
  if (body.answers !== undefined && !jsonEqual(body.answers, existing.answers)) {
    return true;
  }

  if (
    body.winnerAnswerId !== undefined &&
    body.winnerAnswerId !== existing.winnerAnswerId
  ) {
    return true;
  }

  if (
    Object.prototype.hasOwnProperty.call(body, 'improvedAnswer') &&
    !jsonEqual(body.improvedAnswer, existing.improvedAnswer)
  ) {
    return true;
  }

  return false;
}

export function createEvaluationsRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const collection = getEvaluationsCollection();
      const evaluations = await collection.find().sort({ updatedAt: -1 }).toArray();
      res.json(evaluations.map(toApiEvaluation));
    } catch (error) {
      next(error);
    }
  });

  router.post('/estimate', async (req, res, next) => {
    try {
      const body = req.body as Partial<Evaluation> & { phase?: string };
      const phase =
        body.phase === 'generate' ||
        body.phase === 'score' ||
        body.phase === 'improved' ||
        body.phase === 'full'
          ? body.phase
          : 'full';

      const estimate = await estimateEvaluationRun(
        {
          prompt: body.prompt?.trim() ?? '',
          criteriaMode: body.criteriaMode ?? 'default',
          criteria: Array.isArray(body.criteria) ? body.criteria : [],
          answers: Array.isArray(body.answers) ? body.answers : [],
          evaluationConfig: normalizeEvaluationConfig(body.evaluationConfig),
        },
        phase,
      );

      res.json(estimate);
    } catch (error) {
      next(error);
    }
  });

  router.post('/generate-title', async (req, res, next) => {
    try {
      if (!checkGenerateRateLimit(clientGenerateRateKey(req))) {
        res.status(429).json({ message: 'Title generation rate limit exceeded. Try again shortly.' });
        return;
      }

      const title = await generateEvaluationTitle(
        {},
        undefined,
        normalizeEvaluationConfig(req.body?.evaluationConfig),
      );
      res.json({ title });
    } catch (error) {
      next(error);
    }
  });

  router.post('/generate-prompt', async (req, res, next) => {
    try {
      if (!checkGenerateRateLimit(clientGenerateRateKey(req))) {
        res.status(429).json({ message: 'Prompt generation rate limit exceeded. Try again shortly.' });
        return;
      }

      const body = req.body as { title?: string; evaluationConfig?: unknown } | undefined;
      const title = body?.title?.trim() ?? '';

      if (title.length < 3) {
        res.status(400).json({ message: 'title is required (at least 3 characters).' });
        return;
      }

      const prompt = await generateEvaluationPrompt(
        title,
        {},
        undefined,
        normalizeEvaluationConfig(body?.evaluationConfig),
      );
      res.json({ prompt });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const objectId = parseObjectId(req.params['id']);

      if (!objectId) {
        res.status(400).json({ message: 'Invalid evaluation id' });
        return;
      }

      const evaluation = await getEvaluationsCollection().findOne({ _id: objectId });

      if (!evaluation) {
        res.status(404).json({ message: 'Evaluation not found' });
        return;
      }

      res.json(toApiEvaluation(evaluation));
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const body = req.body as Partial<Evaluation>;

      if (!body.title?.trim() || !body.prompt?.trim()) {
        res.status(400).json({ message: 'title and prompt are required' });
        return;
      }

      const now = new Date().toISOString();
      const document: EvaluationRecord = {
        title: body.title.trim(),
        prompt: body.prompt.trim(),
        criteriaMode: body.criteriaMode ?? 'default',
        criteria: Array.isArray(body.criteria)
          ? body.criteria.map((criterion) => ({
              ...criterion,
              weight:
                Number.isFinite(criterion.weight) && (criterion.weight ?? 0) > 0
                  ? criterion.weight
                  : 1,
            }))
          : [],
        evaluationConfig: normalizeEvaluationConfig(body.evaluationConfig),
        answers: Array.isArray(body.answers) ? body.answers : [],
        ...(body.improvedAnswer !== undefined ? { improvedAnswer: body.improvedAnswer } : {}),
        ...(body.winnerAnswerId !== undefined ? { winnerAnswerId: body.winnerAnswerId } : {}),
        createdAt: now,
        updatedAt: now,
      };

      const result = await getEvaluationsCollection().insertOne(document);
      const inserted = await getEvaluationsCollection().findOne({ _id: result.insertedId });

      if (!inserted) {
        res.status(500).json({ message: 'Failed to create evaluation' });
        return;
      }

      res.status(201).json(toApiEvaluation(inserted));
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const objectId = parseObjectId(req.params['id']);

      if (!objectId) {
        res.status(400).json({ message: 'Invalid evaluation id' });
        return;
      }

      const collection = getEvaluationsCollection();
      const existing = (await collection.findOne({ _id: objectId })) as EvaluationDocument | null;

      if (!existing) {
        res.status(404).json({ message: 'Evaluation not found' });
        return;
      }

      const body = req.body as Partial<Evaluation>;
      const evaluationId = objectId.toString();

      if (
        typeof body.updatedAt === 'string' &&
        body.updatedAt.length > 0 &&
        body.updatedAt < existing.updatedAt
      ) {
        res.status(409).json({
          message: 'Evaluation was updated elsewhere. Refresh and try again.',
        });
        return;
      }

      const automationActive = isEvaluationAutomationActive(evaluationId);

      if (automationActive && wouldOverwriteAutomationOwnedFields(body, existing)) {
        res.status(409).json({
          message:
            'Automation is in progress. Answers, winner, and improved answer cannot be edited until it finishes.',
        });
        return;
      }

      const now = new Date().toISOString();

      // While automation owns answers/winner/improved, never $set those fields from the
      // client (or from a stale findOne snapshot) — checkpoints can land between read and write.
      if (automationActive) {
        const metadataSet = {
          title: body.title?.trim() ?? existing.title,
          prompt: body.prompt?.trim() ?? existing.prompt,
          criteriaMode: body.criteriaMode ?? existing.criteriaMode ?? 'default',
          criteria: body.criteria ?? existing.criteria,
          updatedAt: now,
        };

        await collection.updateOne({ _id: objectId }, { $set: metadataSet });
        const fresh = (await collection.findOne({ _id: objectId })) as EvaluationDocument | null;

        if (!fresh) {
          res.status(404).json({ message: 'Evaluation not found' });
          return;
        }

        res.json(toApiEvaluation(fresh));
        return;
      }

      const updated: EvaluationRecord = normalizeEvaluationRecord(
        {
          title: body.title?.trim() ?? existing.title,
          prompt: body.prompt?.trim() ?? existing.prompt,
          criteriaMode: body.criteriaMode ?? existing.criteriaMode ?? 'default',
          criteria: body.criteria ?? existing.criteria,
          evaluationConfig: normalizeEvaluationConfig(
            body.evaluationConfig ?? existing.evaluationConfig,
          ),
          answers: body.answers ?? existing.answers,
          improvedAnswer: body.improvedAnswer ?? existing.improvedAnswer,
          winnerAnswerId: body.winnerAnswerId ?? existing.winnerAnswerId,
          manualOverrides: body.manualOverrides ?? existing.manualOverrides,
          ...(existing.automatedAt !== undefined ? { automatedAt: existing.automatedAt } : {}),
          ...(existing.lastScoringRun !== undefined ? { lastScoringRun: existing.lastScoringRun } : {}),
          ...(existing.scoringConfigRevision !== undefined
            ? { scoringConfigRevision: existing.scoringConfigRevision }
            : {}),
          ...(existing.tokenUsage !== undefined ? { tokenUsage: existing.tokenUsage } : {}),
          createdAt: existing.createdAt,
          updatedAt: now,
        },
        evaluationId,
      );

      // Preserve automationRunId ownership — never clear via unguarded PUT.
      const setDoc: EvaluationRecord & { automationRunId?: string } = {
        ...updated,
        ...(existing.automationRunId !== undefined
          ? { automationRunId: existing.automationRunId }
          : {}),
      };

      await collection.updateOne({ _id: objectId }, { $set: setDoc });
      res.json(toApiEvaluation({ _id: objectId, ...setDoc }));
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const objectId = parseObjectId(req.params['id']);

      if (!objectId) {
        res.status(400).json({ message: 'Invalid evaluation id' });
        return;
      }

      const evaluationId = objectId.toString();

      if (isEvaluationAutomationActive(evaluationId)) {
        res.status(409).json({
          message: 'Automation is in progress. Cancel or wait before deleting this evaluation.',
        });
        return;
      }

      const result = await getEvaluationsCollection().deleteOne({ _id: objectId });

      if (result.deletedCount === 0) {
        res.status(404).json({ message: 'Evaluation not found' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
