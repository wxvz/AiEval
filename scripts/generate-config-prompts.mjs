#!/usr/bin/env node
/**
 * Wrapper — runs the resilient-LLM TypeScript batch script.
 *
 * Timing: defaults to ~2.2s between judge calls (Groq 30 RPM). Override with
 * CONFIG_PROMPT_BATCH_DELAY_MS or LLM_INTER_CALL_DELAY_MS (whichever is higher).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../server/scripts/generate-config-prompts.ts',
);

const child = spawn('npx', ['tsx', script], {
  stdio: 'inherit',
  cwd: path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
});

child.on('exit', (code) => process.exit(code ?? 1));
