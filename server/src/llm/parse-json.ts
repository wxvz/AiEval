export function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);

  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  return trimmed;
}

export function parseJsonText<T>(text: string): T {
  const cleaned = stripJsonFences(text);
  return JSON.parse(cleaned) as T;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
