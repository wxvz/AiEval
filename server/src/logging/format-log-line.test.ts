import { describe, expect, it } from 'vitest';

import { formatLogTextLine } from './format-log-line.js';

describe('formatLogTextLine', () => {
  it('formats explicit messages as Level: message', () => {
    expect(
      formatLogTextLine({
        ts: '2026-05-18T00:00:00.000Z',
        level: 'info',
        event: 'automation.pipeline_step',
        message: 'Next step: scoring',
      }),
    ).toBe('INFO: Next step: scoring');
  });

  it('formats HTTP requests', () => {
    expect(
      formatLogTextLine({
        level: 'info',
        event: 'http.request',
        method: 'POST',
        path: '/api/evaluations/x/automate',
        status: 202,
        durationMs: 12,
      }),
    ).toBe('INFO: POST /api/evaluations/x/automate → 202 (12ms)');
  });

  it('falls back to key=value pairs for unknown events', () => {
    expect(
      formatLogTextLine({
        level: 'warn',
        event: 'custom.event',
        code: 42,
        note: 'retry',
      }),
    ).toBe('WARN: custom.event code=42 note=retry');
  });
});
