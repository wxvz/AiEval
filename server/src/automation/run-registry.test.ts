import { afterEach, describe, expect, it, vi } from 'vitest';

import { waitForProviderChoice } from './provider-choice.js';
import {
  cancelAllActiveAutomations,
  cancelAutomationRun,
  clearAutomationRun,
  hasPendingCancel,
  ownsAutomationRun,
  PENDING_CANCEL_TTL_MS,
  registerAutomationRun,
} from './run-registry.js';

describe('registerAutomationRun', () => {
  const evaluationId = 'eval-supersede-test';

  afterEach(() => {
    cancelAutomationRun(evaluationId, 'run-a');
    cancelAutomationRun(evaluationId, 'run-b');
    cancelAutomationRun(evaluationId, 'run-pre');
    clearAutomationRun(evaluationId, 'run-a');
    clearAutomationRun(evaluationId, 'run-b');
    clearAutomationRun(evaluationId, 'run-pre');
  });

  it('rejects pending provider choice when superseded by a new run', async () => {
    registerAutomationRun(evaluationId, 'run-a');
    const choicePromise = waitForProviderChoice(evaluationId, 'run-a');

    registerAutomationRun(evaluationId, 'run-b');

    await expect(choicePromise).rejects.toThrow('Automation cancelled.');
  });

  it('aborts immediately when cancel was recorded before register', () => {
    expect(cancelAutomationRun(evaluationId, 'run-pre')).toBe(true);

    const signal = registerAutomationRun(evaluationId, 'run-pre');

    expect(signal.aborted).toBe(true);
    expect(ownsAutomationRun(evaluationId, 'run-pre')).toBe(true);
  });
});

describe('cancelAutomationRun', () => {
  const evaluationId = 'eval-cancel-test';

  afterEach(() => {
    vi.useRealTimers();
    cancelAutomationRun(evaluationId, 'run-active');
    clearAutomationRun(evaluationId, 'run-active');
  });

  it('records a pending cancel when no run is active yet', () => {
    expect(cancelAutomationRun(evaluationId, 'run-pending')).toBe(true);
    expect(hasPendingCancel(evaluationId, 'run-pending')).toBe(true);
  });

  it('expires pending cancels older than TTL', () => {
    vi.useFakeTimers();
    expect(cancelAutomationRun(evaluationId, 'run-stale')).toBe(true);
    expect(hasPendingCancel(evaluationId, 'run-stale')).toBe(true);

    vi.advanceTimersByTime(PENDING_CANCEL_TTL_MS + 1);

    expect(hasPendingCancel(evaluationId, 'run-stale')).toBe(false);
  });

  it('does not apply an expired pending cancel on register', () => {
    vi.useFakeTimers();
    expect(cancelAutomationRun(evaluationId, 'run-expired')).toBe(true);

    vi.advanceTimersByTime(PENDING_CANCEL_TTL_MS + 1);

    const signal = registerAutomationRun(evaluationId, 'run-expired');

    expect(signal.aborted).toBe(false);
    expect(ownsAutomationRun(evaluationId, 'run-expired')).toBe(true);
    clearAutomationRun(evaluationId, 'run-expired');
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

  it('clears pending cancels for a finished runId', () => {
    expect(cancelAutomationRun(evaluationId, 'run-finished')).toBe(true);
    expect(hasPendingCancel(evaluationId, 'run-finished')).toBe(true);

    clearAutomationRun(evaluationId, 'run-finished');

    expect(hasPendingCancel(evaluationId, 'run-finished')).toBe(false);
  });
});

describe('cancelAllActiveAutomations', () => {
  const evalA = 'eval-shutdown-a';
  const evalB = 'eval-shutdown-b';

  afterEach(() => {
    clearAutomationRun(evalA, 'run-a');
    clearAutomationRun(evalB, 'run-b');
  });

  it('aborts every active run and clears pending cancels', () => {
    cancelAllActiveAutomations();

    const signalA = registerAutomationRun(evalA, 'run-a');
    const signalB = registerAutomationRun(evalB, 'run-b');
    expect(cancelAutomationRun('eval-pending', 'run-pending')).toBe(true);
    expect(hasPendingCancel('eval-pending', 'run-pending')).toBe(true);

    expect(cancelAllActiveAutomations()).toBe(2);

    expect(signalA.aborted).toBe(true);
    expect(signalB.aborted).toBe(true);
    expect(ownsAutomationRun(evalA, 'run-a')).toBe(false);
    expect(ownsAutomationRun(evalB, 'run-b')).toBe(false);
    expect(hasPendingCancel('eval-pending', 'run-pending')).toBe(false);
  });
});
