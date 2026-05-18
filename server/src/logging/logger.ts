import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import { config } from '../config.js';
import type { LogContext, LogEventName, LogLevel } from './events.js';
import { formatLogTextLine } from './format-log-line.js';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let logFileWriteQueue: Promise<void> = Promise.resolve();
let logFileDirReady: Promise<void> | null = null;

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[config.logLevel];
}

function ensureLogFileDir(): Promise<void> {
  if (!config.logFile) {
    return Promise.resolve();
  }

  if (!logFileDirReady) {
    logFileDirReady = mkdir(dirname(config.logFile), { recursive: true }).then(
      () => undefined,
      () => undefined,
    );
  }

  return logFileDirReady;
}

function enqueueLogFileWrite(line: string): void {
  if (!config.logFile) {
    return;
  }

  logFileWriteQueue = logFileWriteQueue
    .then(async () => {
      await ensureLogFileDir();
      await appendFile(config.logFile, `${line}\n`, 'utf8');
    })
    .catch(() => {
      // ignore file write errors
    });
}

function formatConsoleLine(payload: Record<string, unknown>): string {
  switch (config.logFormat) {
    case 'text':
      return formatLogTextLine(payload);
    case 'pretty':
      return JSON.stringify(payload, null, 2);
    default:
      return JSON.stringify(payload);
  }
}

function writeLine(payload: Record<string, unknown>): void {
  const jsonLine = JSON.stringify(payload);
  const consoleLine = formatConsoleLine(payload);

  process.stdout.write(`${consoleLine}\n`);
  enqueueLogFileWrite(jsonLine);
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
