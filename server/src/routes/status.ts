import { Router } from 'express';

import { config } from '../config.js';
import { probeMongo } from '../db.js';
import { probeActiveProvider, probeAllProviders } from '../llm/provider.js';

export function createStatusRouter(): Router {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const [mongo, providers, active] = await Promise.all([
        probeMongo(),
        probeAllProviders(),
        probeActiveProvider(),
      ]);

      res.json({
        mongo,
        llmPreset: config.llmPreset,
        providers,
        activeProvider:
          active?.status === 'ready'
            ? {
                name: active.name,
                answerModels: active.answerModels,
                judgeModel: active.judgeModel,
              }
            : null,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
