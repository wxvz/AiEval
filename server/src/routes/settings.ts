import { Router } from 'express';

import { hasAnyActiveAutomationRun } from '../automation/run-registry.js';
import { isApiTokenRequired, requireApiToken } from '../middleware/api-token.js';
import {
  getEnvDefaultLlmPreset,
  getLlmPreset,
  isValidLlmPreset,
  setLlmPreset,
  type LlmPreset,
} from '../runtime-settings.js';

function settingsPayload(): {
  llmPreset: LlmPreset;
  envDefaultLlmPreset: LlmPreset;
  apiTokenRequired: boolean;
} {
  return {
    llmPreset: getLlmPreset(),
    envDefaultLlmPreset: getEnvDefaultLlmPreset(),
    apiTokenRequired: isApiTokenRequired(),
  };
}

export function createSettingsRouter(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(settingsPayload());
  });

  // GET stays open; PATCH requires Bearer when AIEVAL_API_TOKEN is set.
  // Last-write-wins is fine; reject changes while any automation is active so
  // in-flight runs keep a stable overlay.
  router.patch('/', requireApiToken, (req, res) => {
    const preset = req.body?.llmPreset;

    if (!isValidLlmPreset(preset)) {
      res.status(400).json({ message: 'llmPreset must be "balanced" or "fast".' });
      return;
    }

    if (hasAnyActiveAutomationRun()) {
      res.status(409).json({
        message: 'Cannot change LLM preset while an automation run is active.',
      });
      return;
    }

    setLlmPreset(preset);
    res.json(settingsPayload());
  });

  return router;
}
