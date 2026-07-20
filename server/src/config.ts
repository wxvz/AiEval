import 'dotenv/config';

const DEFAULT_PORT = 3000;

function parseIntEnv(
  raw: string | undefined,
  fallback: number,
  options: { min?: number; max?: number } = {},
): number {
  const { min = 0, max = Number.MAX_SAFE_INTEGER } = options;

  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function parseLogLevel(value: string | undefined): 'debug' | 'info' | 'warn' | 'error' {
  const level = value?.toLowerCase();

  if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
    return level;
  }

  return 'info';
}

function parseLogFormat(value: string | undefined): 'json' | 'pretty' | 'text' {
  const format = value?.toLowerCase();

  if (format === 'pretty' || format === 'text') {
    return format;
  }

  return 'json';
}

function parsePreset(value: string | undefined): 'fast' | 'balanced' {
  return value === 'fast' ? 'fast' : 'balanced';
}

export const config = {
  port: parseIntEnv(process.env['PORT'], DEFAULT_PORT, { min: 1, max: 65_535 }),
  mongoUri: process.env['MONGODB_URI'] ?? '',
  dbName: process.env['MONGODB_DB_NAME'] ?? 'aieval',
  evaluationsCollection: 'evaluations',
  templatesCollection: 'evaluation_templates',
  ollamaBaseUrl: process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434',
  groqApiKey: process.env['GROQ_API_KEY'] ?? '',
  openRouterApiKey: process.env['OPENROUTER_API_KEY'] ?? '',
  openRouterHttpReferer:
    process.env['OPENROUTER_HTTP_REFERER'] ?? 'http://localhost:4200',
  openRouterAppTitle: process.env['OPENROUTER_APP_TITLE'] ?? 'AiEval',
  geminiApiKey: process.env['GEMINI_API_KEY'] ?? '',
  huggingFaceApiKey: process.env['HUGGINGFACE_API_KEY'] ?? '',
  llmPreset: parsePreset(process.env['LLM_PRESET']),
  llmAnswerModels: process.env['LLM_ANSWER_MODELS'] ?? '',
  llmJudgeModel: process.env['LLM_JUDGE_MODEL'] ?? '',
  llmInterCallDelayMs: parseIntEnv(process.env['LLM_INTER_CALL_DELAY_MS'], 200, {
    min: 0,
    max: 60_000,
  }),
  llmConcurrency: parseIntEnv(process.env['LLM_CONCURRENCY'], 3, { min: 1, max: 32 }),
  llmRequestTimeoutMs: parseIntEnv(
    process.env['LLM_REQUEST_TIMEOUT_MS'],
    15 * 60 * 1000,
    { min: 1_000, max: 24 * 60 * 60 * 1000 },
  ),
  llmSlowFallbackMs: parseIntEnv(process.env['LLM_SLOW_FALLBACK_MS'], 3 * 60 * 1000, {
    min: 0,
    max: 60 * 60 * 1000,
  }),
  llmMaxRetries: parseIntEnv(process.env['LLM_MAX_RETRIES'], 2, { min: 0, max: 10 }),
  llmBackoffBaseMs: parseIntEnv(process.env['LLM_BACKOFF_BASE_MS'], 500, {
    min: 0,
    max: 60_000,
  }),
  logLevel: parseLogLevel(process.env['LOG_LEVEL']),
  logFormat: parseLogFormat(process.env['LOG_FORMAT']),
  logFile: process.env['LOG_FILE'] ?? '',
  logPrompts: process.env['LOG_PROMPTS'] === 'true',
  startupPreflight: process.env['STARTUP_PREFLIGHT'] !== 'false',
  /** n8n Learn tutor webhook (production URL). Empty disables /api/learn-chat. */
  learnChatWebhookUrl: process.env['LEARN_CHAT_WEBHOOK_URL']?.trim() ?? '',
} as const;

export function assertConfig(): void {
  if (!config.mongoUri) {
    throw new Error('MONGODB_URI is required. Set it in your .env file.');
  }
}
