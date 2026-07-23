import { Router } from 'express';

import { normalizeEvaluationConfig } from '../evaluation-config.js';
import { getTemplatesCollection } from '../db.js';
import { parseObjectId } from '../serialization.js';
import type {
  EvaluationTemplate,
  EvaluationTemplateRecord,
} from '../types/evaluation-template.js';

function toApiTemplate(doc: EvaluationTemplateRecord & { _id: import('mongodb').ObjectId }): EvaluationTemplate {
  const { _id, ...rest } = doc;

  return {
    id: _id.toString(),
    ...rest,
    evaluationConfig: normalizeEvaluationConfig(rest.evaluationConfig),
    criteria: Array.isArray(rest.criteria)
      ? rest.criteria.map((criterion) => ({
          ...criterion,
          weight:
            typeof criterion.weight === 'number' &&
            Number.isFinite(criterion.weight) &&
            criterion.weight > 0
              ? criterion.weight
              : 1,
        }))
      : [],
  };
}

export function createTemplatesRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const templates = await getTemplatesCollection().find().sort({ updatedAt: -1 }).toArray();
      res.json(templates.map(toApiTemplate));
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const objectId = parseObjectId(req.params['id']);

      if (!objectId) {
        res.status(400).json({ message: 'Invalid template id' });
        return;
      }

      const template = await getTemplatesCollection().findOne({ _id: objectId });

      if (!template) {
        res.status(404).json({ message: 'Template not found' });
        return;
      }

      res.json(toApiTemplate(template));
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const body = req.body as Partial<EvaluationTemplate>;
      const name = body.name?.trim() ?? '';

      if (name.length < 2) {
        res.status(400).json({ message: 'name is required (at least 2 characters)' });
        return;
      }

      const now = new Date().toISOString();
      const document: EvaluationTemplateRecord = {
        name,
        title: body.title?.trim() ?? '',
        prompt: body.prompt?.trim() ?? '',
        criteriaMode: body.criteriaMode ?? 'default',
        criteria: Array.isArray(body.criteria) ? body.criteria : [],
        evaluationConfig: normalizeEvaluationConfig(body.evaluationConfig),
        createdAt: now,
        updatedAt: now,
      };

      const result = await getTemplatesCollection().insertOne(document);
      const inserted = await getTemplatesCollection().findOne({ _id: result.insertedId });

      if (!inserted) {
        res.status(500).json({ message: 'Failed to create template' });
        return;
      }

      res.status(201).json(toApiTemplate(inserted));
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const objectId = parseObjectId(req.params['id']);

      if (!objectId) {
        res.status(400).json({ message: 'Invalid template id' });
        return;
      }

      const result = await getTemplatesCollection().deleteOne({ _id: objectId });

      if (result.deletedCount === 0) {
        res.status(404).json({ message: 'Template not found' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
