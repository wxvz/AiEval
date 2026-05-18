import { afterEach, describe, expect, it } from 'vitest';

import {
  submitProviderChoice,
  waitForProviderChoice,
} from './provider-choice.js';

describe('waitForProviderChoice', () => {
  const evaluationId = 'eval-provider-choice';

  afterEach(() => {
    submitProviderChoice(evaluationId, undefined, false);
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
