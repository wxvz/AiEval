const API_TOKEN_HINT = 'Add or update your API token in Settings.';

export function messageFromHttpError(error: unknown, fallback: string): string {
  const status = (error as { status?: number })?.status;
  const body = (error as { error?: { message?: unknown } })?.error;
  const serverMessage =
    typeof body?.message === 'string' && body.message.trim()
      ? body.message.trim()
      : null;

  if (status === 401) {
    if (serverMessage && serverMessage.toLowerCase() !== 'unauthorized') {
      const prefix = /[.!?]$/.test(serverMessage) ? serverMessage : `${serverMessage}.`;
      return `${prefix} ${API_TOKEN_HINT}`;
    }

    return `Unauthorized. ${API_TOKEN_HINT}`;
  }

  return serverMessage ?? fallback;
}
