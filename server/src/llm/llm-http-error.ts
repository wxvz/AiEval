/** Minimal response shape from `llmFetch` (undici) and test mocks. */
export interface LlmHttpResponse {
  status: number;
  text(): Promise<string>;
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
