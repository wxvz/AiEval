import { Router } from 'express';
import type { Collection } from 'mongodb';

import type { Evaluation } from '../types/evaluation.js';

export function createEvaluationsRouter(collection: Collection<Evaluation>): Router {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const evaluations = await collection.find().sort({ updatedAt: -1 }).toArray();
      res.json(evaluations);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const evaluation = await collection.findOne({ id: req.params['id'] });

      if (!evaluation) {
        res.status(404).json({ message: 'Evaluation not found' });
        return;
      }

      res.json(evaluation);
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
      const evaluation: Evaluation = {
        id: body.id ?? crypto.randomUUID(),
        title: body.title.trim(),
        prompt: body.prompt.trim(),
        criteriaMode: body.criteriaMode ?? 'default',
        criteria: Array.isArray(body.criteria) ? body.criteria : [],
        answers: Array.isArray(body.answers) ? body.answers : [],
        ...(body.improvedAnswer !== undefined ? { improvedAnswer: body.improvedAnswer } : {}),
        ...(body.winnerAnswerId !== undefined ? { winnerAnswerId: body.winnerAnswerId } : {}),
        ...(body.rubricId !== undefined ? { rubricId: body.rubricId } : {}),
        createdAt: body.createdAt ?? now,
        updatedAt: now,
      };

      await collection.insertOne(evaluation);
      res.status(201).json(evaluation);
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const existing = await collection.findOne({ id });

      if (!existing) {
        res.status(404).json({ message: 'Evaluation not found' });
        return;
      }

      const body = req.body as Partial<Evaluation>;
      const updated: Evaluation = {
        ...existing,
        ...body,
        id: existing.id,
        title: body.title?.trim() ?? existing.title,
        prompt: body.prompt?.trim() ?? existing.prompt,
        criteria: body.criteria ?? existing.criteria,
        answers: body.answers ?? existing.answers,
        updatedAt: new Date().toISOString(),
      };

      await collection.updateOne({ id }, { $set: updated });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const result = await collection.deleteOne({ id: req.params['id'] });

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
