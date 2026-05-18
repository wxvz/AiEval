import { Router } from 'express';
import { getEvaluationsCollection } from '../db.js';
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
        criteria: Array.isArray(body.criteria) ? body.criteria : [],
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
          answers: body.answers ?? existing.answers,
          improvedAnswer: body.improvedAnswer ?? existing.improvedAnswer,
          winnerAnswerId: body.winnerAnswerId ?? existing.winnerAnswerId,
          ...(existing.automatedAt !== undefined ? { automatedAt: existing.automatedAt } : {}),
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
