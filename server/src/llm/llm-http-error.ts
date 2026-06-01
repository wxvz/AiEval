/** Minimal response shape from `llmFetch` and test mocks. */
export interface LlmHttpResponse {
  status: number;
  text(): Promise<string>;
}

const FALLBACK_ELIGIBLE_HTTP_STATUSES = new Set([404, 408, 500, 502, 503, 504]);

const THROW_LLM_HTTP_ERROR_STATUS = /: (\d{3}) —/;
const SIMPLE_REQUEST_FAILED_STATUS = /request failed: (\d{3})\b/i;

/** Parses HTTP status from provider error messages (Groq/OpenRouter em-dash or simple formats). */
export function parseLlmHttpStatusFromError(error: Error): number | undefined {
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
  throw new Error(`${prefix}: ${response.status} — ${detail}`);
}
