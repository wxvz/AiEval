import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { config } from '../config.js';
import type { LogContext, LogEventName, LogLevel } from './events.js';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[config.logLevel];
}

function writeLine(payload: Record<string, unknown>): void {
  const line =
    config.logFormat === 'pretty'
      ? JSON.stringify(payload, null, 2)
      : JSON.stringify(payload);

  process.stdout.write(`${line}\n`);

  if (config.logFile) {
    try {
      mkdirSync(dirname(config.logFile), { recursive: true });
      appendFileSync(config.logFile, `${line}\n`, 'utf8');
    } catch {
      // ignore file write errors
    }
  }
}

export function logEvent(level: LogLevel, event: LogEventName, context: LogContext = {}): void {
  if (!shouldLog(level)) {
    return;
  }

  const { message, ...rest } = context;

  writeLine({
    ts: new Date().toISOString(),
    level,
    event,
    ...(message !== undefined ? { message } : {}),
    ...rest,
  });
}

export function logPromptSnippet(
  runId: string | undefined,
  evaluationId: string | undefined,
  label: string,
  text: string,
): void {
  if (!config.logPrompts || !shouldLog('debug')) {
    return;
  }

  logEvent('debug', 'llm.request', {
    runId,
    evaluationId,
    label,
    promptLength: text.length,
    prompt: text,
  });
}
