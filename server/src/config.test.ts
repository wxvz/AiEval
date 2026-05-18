import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('config', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('falls back when numeric env values are invalid', async () => {
    vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
    vi.stubEnv('LLM_CONCURRENCY', 'not-a-number');
    vi.stubEnv('LLM_INTER_CALL_DELAY_MS', '');
    vi.stubEnv('PORT', 'NaN');

    const { config } = await import('./config.js');

    expect(config.llmConcurrency).toBe(3);
    expect(config.llmInterCallDelayMs).toBe(200);
    expect(config.port).toBe(3000);
  });

  it('clamps numeric env values to allowed bounds', async () => {
    vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017');
    vi.stubEnv('LLM_CONCURRENCY', '999');
    vi.stubEnv('LLM_MAX_RETRIES', '-1');

    const { config } = await import('./config.js');

    expect(config.llmConcurrency).toBe(32);
    expect(config.llmMaxRetries).toBe(0);
  });
});
