import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('logger', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('LOG_LEVEL', 'info');
    vi.stubEnv('LOG_FORMAT', 'json');
    vi.stubEnv('LOG_FILE', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('suppresses debug when LOG_LEVEL is info', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const { logEvent } = await import('./logger.js');
    const { LogEvents } = await import('./events.js');

    logEvent('debug', LogEvents.llmRequest, { message: 'hidden' });
    logEvent('info', LogEvents.automationStarted, { message: 'visible' });

    const output = write.mock.calls.map((call) => String(call[0])).join('');
    expect(output).not.toContain('llm.request');
    expect(output).toContain('automation.started');
  });
});
