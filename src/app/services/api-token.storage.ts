/** Browser-stored API token for AIEVAL_API_TOKEN-protected routes. */
export const API_TOKEN_STORAGE_KEY = 'aieval-api-token';

export function readStoredApiToken(): string | null {
  try {
    const token = localStorage.getItem(API_TOKEN_STORAGE_KEY)?.trim();
    return token || null;
  } catch {
    return null;
  }
}

export function writeStoredApiToken(token: string): void {
  const trimmed = token.trim();

  try {
    if (!trimmed) {
      localStorage.removeItem(API_TOKEN_STORAGE_KEY);
      return;
    }

    localStorage.setItem(API_TOKEN_STORAGE_KEY, trimmed);
  } catch {
    // Quota / private mode — ignore.
  }
}
