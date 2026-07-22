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

  it('formats llm.prompt without provider/model', () => {
    expect(
      formatLogTextLine({
        level: 'debug',
        event: 'llm.prompt',
        label: 'user',
        promptLength: 120,
      }),
    ).toBe('DEBUG: LLM prompt [user] (120 chars)');
  });

  it('formats llm.slow_fallback with from/to or provider', () => {
    expect(
      formatLogTextLine({
        level: 'warn',
        event: 'llm.slow_fallback',
        from: 'ollama',
        to: 'groq',
        durationMs: 180_000,
      }),
    ).toBe('WARN: LLM slow fallback (180000ms: ollama → groq)');

    expect(
      formatLogTextLine({
        level: 'info',
        event: 'llm.slow_fallback',
        provider: 'ollama',
        durationMs: 180_000,
      }),
    ).toBe('INFO: LLM slow fallback (180000ms on ollama)');
  });

  it('formats automation.provider_choice', () => {
    expect(
      formatLogTextLine({
        level: 'info',
        event: 'automation.provider_choice',
        evaluationId: 'abc123def456',
        useCloud: true,
      }),
    ).toBe('INFO: Provider choice for abc123de…: cloud');
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

  it('formats answer rejected and model fallback clearly', () => {
    expect(
      formatLogTextLine({
        level: 'warn',
        event: 'automation.answer_rejected',
        model: 'qwen/qwen3.6-27b',
        reason: 'empty_content',
        detail: 'Answer qwen3.6-27b has empty content (sanitized empty).',
      }),
    ).toBe(
      'WARN: Answer rejected (qwen/qwen3.6-27b, empty_content): Answer qwen3.6-27b has empty content (sanitized empty).',
    );

    expect(
      formatLogTextLine({
        level: 'warn',
        event: 'automation.model_fallback',
        step: 'generating',
        fromModel: 'qwen/qwen3.6-27b',
        toModel: 'openrouter/free',
      }),
    ).toBe('WARN: Model fallback [generating]: qwen/qwen3.6-27b → openrouter/free');
  });
});
