import { Router } from 'express';

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
import type { Evaluation, EvaluationRecord } from '../types/evaluation.js';

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
      const title = await generateEvaluationTitle({}, undefined, normalizeEvaluationConfig(req.body?.evaluationConfig));
      res.json({ title });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate title';
      res.status(500).json({ message });
    }
  });

  router.post('/generate-prompt', async (req, res, next) => {
    try {
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
      const message = error instanceof Error ? error.message : 'Failed to generate prompt';
      res.status(500).json({ message });
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
      const existing = await collection.findOne({ _id: objectId });

      if (!existing) {
        res.status(404).json({ message: 'Evaluation not found' });
        return;
      }

      const body = req.body as Partial<Evaluation>;
      const evaluationId = objectId.toString();
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
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
        },
        evaluationId,
      );

      await collection.updateOne({ _id: objectId }, { $set: updated });
      res.json(toApiEvaluation({ _id: objectId, ...updated }));
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
