import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({
  probeMongo: vi.fn(),
}));

vi.mock('../llm/provider.js', () => ({
  probeAllProviders: vi.fn(),
}));

vi.mock('../logging/logger.js', () => ({
  logEvent: vi.fn(),
}));

import { probeMongo } from '../db.js';
import { probeAllProviders } from '../llm/provider.js';
import { logEvent } from '../logging/logger.js';
import { LogEvents } from '../logging/events.js';
import { runStartupPreflight } from './preflight.js';

describe('runStartupPreflight', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('STARTUP_PREFLIGHT', 'true');
    vi.mocked(probeMongo).mockReset();
    vi.mocked(probeAllProviders).mockReset();
    vi.mocked(logEvent).mockReset();
    vi.mocked(probeMongo).mockResolvedValue({ ok: true, dbName: 'aieval' });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('prints provider summary and logs structured preflight event', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    vi.mocked(probeAllProviders).mockResolvedValue([
      { name: 'ollama', status: 'ready', answerModels: ['llama3.2:3b'], judgeModel: 'llama3.1:8b' },
      { name: 'groq', status: 'unavailable', reason: 'API key not set' },
      { name: 'openrouter', status: 'unavailable', reason: 'API key not set' },
      { name: 'gemini', status: 'unavailable', reason: 'API key not set' },
      { name: 'huggingface', status: 'unavailable', reason: 'API key not set' },
    ]);

    await runStartupPreflight();

    const output = log.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('Startup checks');
    expect(output).toContain('MongoDB ............... ok (aieval)');
    expect(output).toContain('Ollama ................ ok — llama3.2:3b');
    expect(output).toContain('Groq .................. unavailable (API key not set)');
    expect(output).toContain('Automation provider ... ollama (llama3.2:3b)');
    expect(warn).not.toHaveBeenCalled();
    expect(probeMongo).toHaveBeenCalledOnce();
    expect(logEvent).toHaveBeenCalledWith(
      'info',
      LogEvents.startupPreflight,
      expect.objectContaining({
        mongoOk: true,
        activeProvider: 'ollama',
        answerModels: ['llama3.2:3b'],
        judgeModel: 'llama3.1:8b',
      }),
    );

    log.mockRestore();
    warn.mockRestore();
  });

  it('reports MongoDB probe failure without aborting startup', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    vi.mocked(probeMongo).mockResolvedValue({
      ok: false,
      dbName: 'aieval',
      reason: 'not connected',
    });
    vi.mocked(probeAllProviders).mockResolvedValue([
      { name: 'ollama', status: 'ready', answerModels: ['llama3.2:3b'], judgeModel: 'llama3.1:8b' },
      { name: 'groq', status: 'unavailable', reason: 'API key not set' },
      { name: 'openrouter', status: 'unavailable', reason: 'API key not set' },
      { name: 'gemini', status: 'unavailable', reason: 'API key not set' },
      { name: 'huggingface', status: 'unavailable', reason: 'API key not set' },
    ]);

    await runStartupPreflight();

    const output = log.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('MongoDB ............... unavailable (not connected)');
    expect(logEvent).toHaveBeenCalledWith(
      'info',
      LogEvents.startupPreflight,
      expect.objectContaining({
        mongoOk: false,
        mongoReason: 'not connected',
      }),
    );
    expect(warn).not.toHaveBeenCalled();

    log.mockRestore();
    warn.mockRestore();
  });

  it('warns when no provider is ready (fail-open)', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    vi.mocked(probeAllProviders).mockResolvedValue([
      { name: 'ollama', status: 'unavailable', reason: 'not reachable' },
      { name: 'groq', status: 'unavailable', reason: 'API key not set' },
      { name: 'openrouter', status: 'unavailable', reason: 'API key not set' },
      { name: 'gemini', status: 'unavailable', reason: 'API key not set' },
      { name: 'huggingface', status: 'unavailable', reason: 'API key not set' },
    ]);

    await runStartupPreflight();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('fail-open'),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('no LLM provider available'),
    );
    expect(logEvent).toHaveBeenCalledWith(
      'info',
      LogEvents.startupPreflight,
      expect.objectContaining({ activeProvider: null, mongoOk: true }),
    );

    log.mockRestore();
    warn.mockRestore();
  });

  it('skips probes when STARTUP_PREFLIGHT is false', async () => {
    vi.stubEnv('STARTUP_PREFLIGHT', 'false');
    vi.resetModules();

    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { runStartupPreflight: runPreflight } = await import('./preflight.js');
    const { LogEvents } = await import('../logging/events.js');

    await runPreflight();

    expect(probeMongo).not.toHaveBeenCalled();
    expect(probeAllProviders).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      'info',
      LogEvents.startupPreflight,
      expect.objectContaining({ skipped: true }),
    );

    log.mockRestore();
  });
});
