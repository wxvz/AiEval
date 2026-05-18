import 'dotenv/config';

const DEFAULT_PORT = 3000;

function parseLogLevel(value: string | undefined): 'debug' | 'info' | 'warn' | 'error' {
  const level = value?.toLowerCase();

  if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
    return level;
  }

  return 'info';
}

function parsePreset(value: string | undefined): 'fast' | 'balanced' {
  return value === 'fast' ? 'fast' : 'balanced';
}

export const config = {
  port: Number(process.env['PORT'] ?? DEFAULT_PORT),
  mongoUri: process.env['MONGODB_URI'] ?? '',
  dbName: process.env['MONGODB_DB_NAME'] ?? 'aieval',
  evaluationsCollection: 'evaluations',
  ollamaBaseUrl: process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434',
  groqApiKey: process.env['GROQ_API_KEY'] ?? '',
  openRouterApiKey: process.env['OPENROUTER_API_KEY'] ?? '',
  geminiApiKey: process.env['GEMINI_API_KEY'] ?? '',
  huggingFaceApiKey: process.env['HUGGINGFACE_API_KEY'] ?? '',
  llmPreset: parsePreset(process.env['LLM_PRESET']),
  llmAnswerModels: process.env['LLM_ANSWER_MODELS'] ?? '',
  llmJudgeModel: process.env['LLM_JUDGE_MODEL'] ?? '',
  llmInterCallDelayMs: Number(process.env['LLM_INTER_CALL_DELAY_MS'] ?? 200),
  llmConcurrency: Number(process.env['LLM_CONCURRENCY'] ?? 3),
  llmRequestTimeoutMs: Number(process.env['LLM_REQUEST_TIMEOUT_MS'] ?? 15 * 60 * 1000),
  llmMaxRetries: Number(process.env['LLM_MAX_RETRIES'] ?? 2),
  llmBackoffBaseMs: Number(process.env['LLM_BACKOFF_BASE_MS'] ?? 500),
  logLevel: parseLogLevel(process.env['LOG_LEVEL']),
  logFormat: process.env['LOG_FORMAT'] === 'pretty' ? 'pretty' : 'json',
  logFile: process.env['LOG_FILE'] ?? '',
  logPrompts: process.env['LOG_PROMPTS'] === 'true',
  startupPreflight: process.env['STARTUP_PREFLIGHT'] !== 'false',
} as const;

export function assertConfig(): void {
  if (!config.mongoUri) {
    throw new Error('MONGODB_URI is required. Set it in your .env file.');
  }
}
