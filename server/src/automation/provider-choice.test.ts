import { afterEach, describe, expect, it } from 'vitest';

import {
  submitProviderChoice,
  waitForProviderChoice,
} from './provider-choice.js';

function cleanupPendingProviderChoice(evaluationId: string, ...runIds: string[]): void {
  for (const runId of runIds) {
    submitProviderChoice(evaluationId, runId, false);
  }
}

describe('waitForProviderChoice', () => {
  const evaluationId = 'eval-provider-choice';

  afterEach(() => {
    cleanupPendingProviderChoice(evaluationId, 'run-shared', 'run-b');
  });

  it('returns the same promise for concurrent waits on the same run', async () => {
    const runId = 'run-shared';

    const first = waitForProviderChoice(evaluationId, runId);
    const second = waitForProviderChoice(evaluationId, runId);
    const third = waitForProviderChoice(evaluationId, runId);

    expect(second).toBe(first);
    expect(third).toBe(first);

    expect(submitProviderChoice(evaluationId, runId, true)).toBe(true);

    await expect(Promise.all([first, second, third])).resolves.toEqual([true, true, true]);
  });

  it('rejects an existing wait when a different runId is registered', async () => {
    const runA = waitForProviderChoice(evaluationId, 'run-a');

    waitForProviderChoice(evaluationId, 'run-b');

    await expect(runA).rejects.toThrow('Provider choice superseded.');
  });
});

describe('submitProviderChoice', () => {
  const evaluationId = 'eval-provider-choice-submit';

  afterEach(() => {
    cleanupPendingProviderChoice(evaluationId, 'run-pending');
  });

  it('returns false when runId does not match the pending run', async () => {
    const pendingRunId = 'run-pending';
    const choice = waitForProviderChoice(evaluationId, pendingRunId);

    expect(submitProviderChoice(evaluationId, 'run-other', true)).toBe(false);

    expect(submitProviderChoice(evaluationId, pendingRunId, true)).toBe(true);
    await expect(choice).resolves.toBe(true);
  });

  it('returns false when runId is empty', () => {
    waitForProviderChoice(evaluationId, 'run-pending');

    expect(submitProviderChoice(evaluationId, '', false)).toBe(false);
  });
});
