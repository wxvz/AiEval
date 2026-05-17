export function messageFromHttpError(error: unknown, fallback: string): string {
  const body = (error as { error?: { message?: unknown } })?.error;
  return typeof body?.message === 'string' && body.message.trim()
    ? body.message.trim()
    : fallback;
}
