const SKIP_KEYS = new Set([
  'ts',
  'level',
  'event',
  'message',
  'abortSignal',
  'currentSetup',
]);

function shortId(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  return value.length > 8 ? `${value.slice(0, 8)}…` : value;
}

function formatKvPairs(context: Record<string, unknown>): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(context)) {
    if (SKIP_KEYS.has(key)) {
      continue;
    }

    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === 'object') {
      continue;
    }

    const display = key === 'evaluationId' || key === 'runId' ? shortId(value) : value;
    parts.push(`${key}=${display}`);
  }

  return parts.join(' ');
}

function eventBody(event: string, payload: Record<string, unknown>): string | undefined {
  const ctx = payload as Record<string, unknown>;

  switch (event) {
    case 'http.request':
      return `${ctx['method']} ${ctx['path']} → ${ctx['status']} (${ctx['durationMs']}ms)`;
    case 'llm.request':
      if (typeof ctx['totalTokens'] === 'number') {
        const estimated = ctx['estimated'] ? '~' : '';
        return `LLM → ${ctx['provider']}/${ctx['model']}${ctx['step'] ? ` [${ctx['step']}]` : ''} (${estimated}${ctx['totalTokens']} tokens)`;
      }

      return `LLM → ${ctx['provider']}/${ctx['model']}${ctx['step'] ? ` [${ctx['step']}]` : ''} (${ctx['promptLength']} chars)`;
    case 'llm.prompt':
      return `LLM prompt [${ctx['label']}] (${ctx['promptLength']} chars)`;
    case 'llm.response':
      if (typeof ctx['totalTokens'] === 'number') {
        const estimated = ctx['estimated'] ? '~' : '';
        return `LLM ← ${ctx['provider']}/${ctx['model']}${ctx['step'] ? ` [${ctx['step']}]` : ''} (${ctx['durationMs']}ms, ${estimated}${ctx['totalTokens']} tokens)`;
      }

      return `LLM ← ${ctx['provider']}/${ctx['model']}${ctx['step'] ? ` [${ctx['step']}]` : ''} (${ctx['durationMs']}ms, ${ctx['outputLength']} chars)`;
    case 'llm.retry':
      return `LLM retry ${ctx['provider']}/${ctx['model']} attempt ${ctx['attempt']}${ctx['message'] ? `: ${ctx['message']}` : ''}`;
    case 'llm.rate_limit':
      return `LLM rate limited ${ctx['provider']}/${ctx['model']} attempt ${ctx['attempt']}`;
    case 'llm.call_failed':
      return `LLM failed ${ctx['provider']}/${ctx['model']}: ${ctx['message'] ?? 'unknown error'}`;
    case 'llm.slow_fallback': {
      const durationMs = ctx['durationMs'];
      const from = ctx['from'] ?? ctx['provider'];
      const to = ctx['to'];
      if (to) {
        return `LLM slow fallback (${durationMs}ms: ${from} → ${to})`;
      }
      return `LLM slow fallback (${durationMs}ms on ${from})`;
    }
    case 'automation.provider_choice':
      return `Provider choice for ${shortId(ctx['evaluationId'])}: ${ctx['useCloud'] ? 'cloud' : 'local'}`;
    case 'automation.started':
      return `Automation started for ${shortId(ctx['evaluationId'])}`;
    case 'automation.complete':
      return `Automation finished for ${shortId(ctx['evaluationId'])}`;
    case 'automation.generating':
      return `Generating answers (${ctx['provider']}/${ctx['model']})`;
    case 'automation.answer_generated':
      return `Answer generated (${ctx['resolvedModel'] ?? ctx['model']}, ${ctx['durationMs']}ms)`;
    case 'automation.scoring':
      return `Scoring answer ${shortId(ctx['answerId'])}`;
    case 'automation.scored':
      return `Scored answer ${shortId(ctx['answerId'])}: ${ctx['totalPoints']} pts`;
    case 'automation.winner_picked':
      return `Winner ${shortId(ctx['answerId'])}: ${ctx['totalPoints']} pts`;
    case 'automation.improved_generating':
      return 'Generating improved answer';
    case 'automation.improved_done':
      return 'Improved answer ready';
    case 'automation.provider_resolved':
      return `Using ${ctx['provider']}/${ctx['model']}`;
    case 'automation.provider_fallback': {
      const base = `Fallback to ${ctx['provider']}/${ctx['model']}`;
      const reason = ctx['message'];
      return typeof reason === 'string' && reason.length > 0 ? `${base}: ${reason}` : base;
    }
    case 'automation.failed':
      return `Automation failed: ${ctx['message'] ?? 'unknown error'}`;
    case 'automation.cancelled':
      return `Automation cancelled for ${shortId(ctx['evaluationId'])}`;
    default:
      return undefined;
  }
}

/** Human-readable log line for terminal output (LOG_FORMAT=text). */
export function formatLogTextLine(payload: Record<string, unknown>): string {
  const level = String(payload['level'] ?? 'info').toUpperCase();
  const message = payload['message'];

  if (typeof message === 'string' && message.length > 0) {
    return `${level}: ${message}`;
  }

  const event = String(payload['event'] ?? 'log');
  const body = eventBody(event, payload);

  if (body) {
    return `${level}: ${body}`;
  }

  const details = formatKvPairs(payload);
  return details ? `${level}: ${event} ${details}` : `${level}: ${event}`;
}
