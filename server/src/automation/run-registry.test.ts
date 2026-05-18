import { afterEach, describe, expect, it } from 'vitest';

import { waitForProviderChoice } from './provider-choice.js';
import { cancelAutomationRun, clearAutomationRun, registerAutomationRun } from './run-registry.js';

describe('registerAutomationRun', () => {
  const evaluationId = 'eval-supersede-test';

  afterEach(() => {
    cancelAutomationRun(evaluationId);
    clearAutomationRun(evaluationId, 'cleanup');
  });

  it('rejects pending provider choice when superseded by a new run', async () => {
    registerAutomationRun(evaluationId, 'run-a');
    const choicePromise = waitForProviderChoice(evaluationId, 'run-a');

    registerAutomationRun(evaluationId, 'run-b');

    await expect(choicePromise).rejects.toThrow('Automation cancelled.');
  });
});
