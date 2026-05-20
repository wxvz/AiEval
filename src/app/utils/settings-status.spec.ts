import { describe, expect, it } from 'vitest';

import {
  formatAutomationPreference,
  formatLlmPreset,
  sanitizeProviderReason,
  serverAggregateMessage,
  serverAggregateReady,
  serverStatTone,
} from './settings-status';

describe('settings-status', () => {
  it('maps serverStatTone to success or danger', () => {
    expect(serverStatTone(true)).toBe('success');
    expect(serverStatTone(false)).toBe('danger');
  });

  it('formats llm preset labels', () => {
    expect(formatLlmPreset('balanced')).toBe('Balanced');
    expect(formatLlmPreset('fast')).toBe('Fast');
  });

  it('reports aggregate readiness', () => {
    expect(serverAggregateReady(true, true)).toBe(true);
    expect(serverAggregateReady(false, true)).toBe(false);
    expect(serverAggregateReady(true, false)).toBe(false);
  });

  it('builds aggregate messages', () => {
    expect(serverAggregateMessage(true, true)).toBe('Ready to evaluate');
    expect(serverAggregateMessage(false, true, 'not connected')).toContain('not connected');
    expect(serverAggregateMessage(true, false)).toContain('no LLM provider');
  });

  it('sanitizes provider reasons', () => {
    expect(sanitizeProviderReason('GROQ_API_KEY not set')).toBe('API key not set');
  });

  it('formats automation preference', () => {
    expect(formatAutomationPreference('ask')).toBe('Ask each time');
    expect(formatAutomationPreference('cloud')).toBe('Prefer cloud');
  });
});
