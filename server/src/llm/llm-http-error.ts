/** Minimal response shape from `llmFetch` and test mocks. */
export interface LlmHttpResponse {
  status: number;
  headers?: { get(name: string): string | null };
  text(): Promise<string>;
}

const FALLBACK_ELIGIBLE_HTTP_STATUSES = new Set([404, 408, 500, 502, 503, 504]);

const THROW_LLM_HTTP_ERROR_STATUS = /: (\d{3}) —/;
const SIMPLE_REQUEST_FAILED_STATUS = /request failed: (\d{3})\b/i;
const TRY_AGAIN_IN_SECONDS = /try again in\s+(\d+(?:\.\d+)?)\s*s\b/i;

/** HTTP error from an LLM provider, optionally carrying a retry wait hint. */
export class LlmHttpError extends Error {
  readonly status: number;
  readonly retryAfterMs?: number;

  constructor(message: string, status: number, retryAfterMs?: number) {
    super(message);
    this.name = 'LlmHttpError';
    this.status = status;

    if (retryAfterMs !== undefined) {
      this.retryAfterMs = retryAfterMs;
    }
  }
}

/** Parses `Retry-After` as delta-seconds or HTTP-date into milliseconds. */
export function parseRetryAfterHeader(value: string | null | undefined): number | undefined {
  if (value == null) {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const seconds = Number(trimmed);

    if (!Number.isFinite(seconds) || seconds < 0) {
      return undefined;
    }

    return Math.ceil(seconds * 1000);
  }

  const dateMs = Date.parse(trimmed);

  if (Number.isNaN(dateMs)) {
    return undefined;
  }

  return Math.max(0, dateMs - Date.now());
}

/** Parses Groq-style "Please try again in 3.7575s" from an error body/message. */
export function parseTryAgainInMs(message: string): number | undefined {
  const match = TRY_AGAIN_IN_SECONDS.exec(message);

  if (!match) {
    return undefined;
  }

  const seconds = Number(match[1]);

  if (!Number.isFinite(seconds) || seconds < 0) {
    return undefined;
  }

  return Math.ceil(seconds * 1000);
}

/** Prefer Retry-After header, then body "try again in Xs" text. */
export function resolveRetryAfterMs(
  response: LlmHttpResponse,
  detail: string,
): number | undefined {
  return parseRetryAfterHeader(response.headers?.get('retry-after')) ?? parseTryAgainInMs(detail);
}

/** Parses HTTP status from provider error messages (Groq/OpenRouter em-dash or simple formats). */
export function parseLlmHttpStatusFromError(error: Error): number | undefined {
  if (error instanceof LlmHttpError) {
    return error.status;
  }

  const throwStyle = THROW_LLM_HTTP_ERROR_STATUS.exec(error.message);
  if (throwStyle) {
    return Number(throwStyle[1]);
  }

  const simpleStyle = SIMPLE_REQUEST_FAILED_STATUS.exec(error.message);
  if (simpleStyle) {
    return Number(simpleStyle[1]);
  }

  return undefined;
}

export function isFallbackEligibleHttpStatus(status: number): boolean {
  return FALLBACK_ELIGIBLE_HTTP_STATUSES.has(status);
}

export async function readLlmErrorMessage(response: LlmHttpResponse): Promise<string> {
  let bodyText = '';

  try {
    bodyText = await response.text();
  } catch {
    return `HTTP ${response.status}`;
  }

  if (!bodyText) {
    return `HTTP ${response.status}`;
  }

  try {
    const parsed = JSON.parse(bodyText) as {
      error?: { message?: string };
      message?: string;
    };
    const message = parsed.error?.message ?? parsed.message;

    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  } catch {
    // fall through to raw body
  }

  const compact = bodyText.replace(/\s+/g, ' ').trim();
  return compact.length > 200 ? `${compact.slice(0, 200)}…` : compact;
}

export async function throwLlmHttpError(prefix: string, response: LlmHttpResponse): Promise<never> {
  const detail = await readLlmErrorMessage(response);
  const retryAfterMs = resolveRetryAfterMs(response, detail);
  throw new LlmHttpError(`${prefix}: ${response.status} — ${detail}`, response.status, retryAfterMs);
}
