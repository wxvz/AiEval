import 'dotenv/config';

import { LogEvents } from '../src/logging/events.js';
import { formatLogTextLine } from '../src/logging/format-log-line.js';
import { logEvent } from '../src/logging/logger.js';

const samples: Array<Parameters<typeof logEvent>> = [
  [
    'info',
    LogEvents.automationPipelineStep,
    {
      runId: 'demo-run-001',
      evaluationId: 'demo-eval-001',
      completed: 'generating',
      nextStep: 'scoring',
      message: 'Next step: scoring',
    },
  ],
  [
    'info',
    LogEvents.httpRequest,
    { method: 'GET', path: '/api/evaluations', status: 200, durationMs: 42 },
  ],
  [
    'warn',
    LogEvents.llmRetry,
    {
      provider: 'openrouter',
      model: 'openrouter/free',
      attempt: 1,
      message: 'Unexpected end of JSON input',
    },
  ],
  [
    'info',
    LogEvents.llmRequest,
    {
      provider: 'openrouter',
      model: 'openrouter/free',
      step: 'generating',
      promptLength: 491,
    },
  ],
  [
    'info',
    LogEvents.automationComplete,
    {
      runId: 'demo-run-001',
      evaluationId: 'demo-eval-001',
      automatedAt: new Date().toISOString(),
    },
  ],
];

console.log('--- LOG_FORMAT=text (terminal) ---\n');

for (const [level, event, context] of samples) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...context,
  };
  console.log(formatLogTextLine(payload));
}

console.log('\n--- Writing same events via logEvent (stdout + logs/server.ndjson) ---\n');

for (const entry of samples) {
  logEvent(...entry);
}
