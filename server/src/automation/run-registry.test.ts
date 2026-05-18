import { afterEach, describe, expect, it } from 'vitest';

import { waitForProviderChoice } from './provider-choice.js';
import { cancelAutomationRun, clearAutomationRun, registerAutomationRun } from './run-registry.js';

describe('registerAutomationRun', () => {
  const evaluationId = 'eval-supersede-test';

  afterEach(() => {
    cancelAutomationRun(evaluationId, 'run-a');
    cancelAutomationRun(evaluationId, 'run-b');
    clearAutomationRun(evaluationId, 'run-a');
    clearAutomationRun(evaluationId, 'run-b');
  });

  it('rejects pending provider choice when superseded by a new run', async () => {
    registerAutomationRun(evaluationId, 'run-a');
    const choicePromise = waitForProviderChoice(evaluationId, 'run-a');

    registerAutomationRun(evaluationId, 'run-b');

    await expect(choicePromise).rejects.toThrow('Automation cancelled.');
  });
});

describe('cancelAutomationRun', () => {
  const evaluationId = 'eval-cancel-test';

  afterEach(() => {
    cancelAutomationRun(evaluationId, 'run-active');
    clearAutomationRun(evaluationId, 'run-active');
  });

  it('returns false when no run is active', () => {
    expect(cancelAutomationRun(evaluationId, 'run-missing')).toBe(false);
  });

  it('returns false when runId is empty', () => {
    registerAutomationRun(evaluationId, 'run-active');

    expect(cancelAutomationRun(evaluationId, '')).toBe(false);
  });

  it('returns false when runId does not match the active run', () => {
    registerAutomationRun(evaluationId, 'run-active');

    expect(cancelAutomationRun(evaluationId, 'run-other')).toBe(false);
  });

  it('aborts the active run when runId matches', () => {
    const signal = registerAutomationRun(evaluationId, 'run-active');

    expect(cancelAutomationRun(evaluationId, 'run-active')).toBe(true);
    expect(signal.aborted).toBe(true);
  });
});
