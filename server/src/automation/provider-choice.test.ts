import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CHOICE_TIMEOUT_MS,
  clearProviderChoice,
  rejectProviderChoice,
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
    vi.useRealTimers();
    cleanupPendingProviderChoice(evaluationId, 'run-shared', 'run-b', 'run-abort', 'run-timeout');
  });

  it('returns the same promise for concurrent waits on the same run', async () => {
    const runId = 'run-shared';

    const first = waitForProviderChoice(evaluationId, runId);
    const second = waitForProviderChoice(evaluationId, runId);
    const third = waitForProviderChoice(evaluationId, runId);

    expect(second).toBe(first);
    expect(third).toBe(first);

    expect(submitProviderChoice(evaluationId, runId, true)).toEqual({ ok: true });

    await expect(Promise.all([first, second, third])).resolves.toEqual([true, true, true]);
  });

  it('rejects an existing wait with cancelled when a different runId is registered', async () => {
    const runA = waitForProviderChoice(evaluationId, 'run-a');

    waitForProviderChoice(evaluationId, 'run-b');

    await expect(runA).rejects.toThrow('Automation cancelled.');
  });

  it('rejects immediately when abortSignal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      waitForProviderChoice(evaluationId, 'run-abort', controller.signal),
    ).rejects.toThrow('Automation cancelled.');
  });

  it('rejects when abortSignal aborts while waiting', async () => {
    const controller = new AbortController();
    const choice = waitForProviderChoice(evaluationId, 'run-abort', controller.signal);

    controller.abort();

    await expect(choice).rejects.toThrow('Automation cancelled.');
  });

  it('rejects after CHOICE_TIMEOUT_MS', async () => {
    vi.useFakeTimers();
    const choice = waitForProviderChoice(evaluationId, 'run-timeout');

    vi.advanceTimersByTime(CHOICE_TIMEOUT_MS);

    await expect(choice).rejects.toThrow('Provider choice timed out.');
  });
});

describe('submitProviderChoice', () => {
  const evaluationId = 'eval-provider-choice-submit';

  afterEach(() => {
    cleanupPendingProviderChoice(evaluationId, 'run-pending');
  });

  it('returns run_mismatch when runId does not match the pending run', async () => {
    const pendingRunId = 'run-pending';
    const choice = waitForProviderChoice(evaluationId, pendingRunId);

    expect(submitProviderChoice(evaluationId, 'run-other', true)).toEqual({
      ok: false,
      reason: 'run_mismatch',
    });

    expect(submitProviderChoice(evaluationId, pendingRunId, true)).toEqual({ ok: true });
    await expect(choice).resolves.toBe(true);
  });

  it('returns run_mismatch when runId is empty', () => {
    waitForProviderChoice(evaluationId, 'run-pending');

    expect(submitProviderChoice(evaluationId, '', false)).toEqual({
      ok: false,
      reason: 'run_mismatch',
    });
  });

  it('returns not_pending when nothing is waiting', () => {
    expect(submitProviderChoice(evaluationId, 'run-missing', true)).toEqual({
      ok: false,
      reason: 'not_pending',
    });
  });
});

describe('clearProviderChoice', () => {
  const evaluationId = 'eval-provider-choice-clear';

  it('rejects pending wait as cancelled', async () => {
    const choice = waitForProviderChoice(evaluationId, 'run-clear');
    clearProviderChoice(evaluationId);
    await expect(choice).rejects.toThrow('Automation cancelled.');
  });

  it('is a no-op when nothing is pending', () => {
    expect(() => clearProviderChoice(evaluationId)).not.toThrow();
  });
});

describe('rejectProviderChoice', () => {
  const evaluationId = 'eval-provider-choice-reject';

  it('rejects with the provided error', async () => {
    const choice = waitForProviderChoice(evaluationId, 'run-reject');
    rejectProviderChoice(evaluationId, new Error('custom reject'));
    await expect(choice).rejects.toThrow('custom reject');
  });
});
