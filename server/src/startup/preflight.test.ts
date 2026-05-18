import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../llm/provider.js', () => ({
  probeAllProviders: vi.fn(),
}));

vi.mock('../logging/logger.js', () => ({
  logEvent: vi.fn(),
}));

import { probeAllProviders } from '../llm/provider.js';
import { logEvent } from '../logging/logger.js';
import { LogEvents } from '../logging/events.js';
import { runStartupPreflight } from './preflight.js';

describe('runStartupPreflight', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('STARTUP_PREFLIGHT', 'true');
    vi.mocked(probeAllProviders).mockReset();
    vi.mocked(logEvent).mockReset();
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

    const { config } = await import('../config.js');
    await runStartupPreflight();

    const output = log.mock.calls.map((call) => String(call[0])).join('\n');
    expect(output).toContain('Startup checks');
    expect(output).toContain(`MongoDB ............... ok (${config.dbName})`);
    expect(output).toContain('Ollama ................ ok — llama3.2:3b');
    expect(output).toContain('Groq .................. unavailable (API key not set)');
    expect(output).toContain('Automation provider ... ollama (llama3.2:3b)');
    expect(warn).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith(
      'info',
      LogEvents.startupPreflight,
      expect.objectContaining({
        activeProvider: 'ollama',
        answerModels: ['llama3.2:3b'],
        judgeModel: 'llama3.1:8b',
      }),
    );

    log.mockRestore();
    warn.mockRestore();
  });

  it('warns when no provider is ready', async () => {
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
      expect.stringContaining('no LLM provider available'),
    );
    expect(logEvent).toHaveBeenCalledWith(
      'info',
      LogEvents.startupPreflight,
      expect.objectContaining({ activeProvider: null }),
    );

    log.mockRestore();
    warn.mockRestore();
  });

  it('skips probes when STARTUP_PREFLIGHT is false', async () => {
    vi.stubEnv('STARTUP_PREFLIGHT', 'false');
    vi.resetModules();

    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { runStartupPreflight: runPreflight } = await import('./preflight.js');

    await runPreflight();

    expect(probeAllProviders).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();

    log.mockRestore();
  });
});
