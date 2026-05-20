import { Router } from 'express';

import {
  getEnvDefaultLlmPreset,
  getLlmPreset,
  isValidLlmPreset,
  setLlmPreset,
  type LlmPreset,
} from '../runtime-settings.js';

function settingsPayload(): { llmPreset: LlmPreset; envDefaultLlmPreset: LlmPreset } {
  return {
    llmPreset: getLlmPreset(),
    envDefaultLlmPreset: getEnvDefaultLlmPreset(),
  };
}

export function createSettingsRouter(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(settingsPayload());
  });

  router.patch('/', (req, res) => {
    const preset = req.body?.llmPreset;

    if (!isValidLlmPreset(preset)) {
      res.status(400).json({ message: 'llmPreset must be "balanced" or "fast".' });
      return;
    }

    setLlmPreset(preset);
    res.json(settingsPayload());
  });

  return router;
}
