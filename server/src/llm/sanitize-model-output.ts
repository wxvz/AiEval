const OPEN_TAG = '<think>';
const CLOSE_TAG = '</think>';
const REDACTED_THINKING_PATTERN = new RegExp(
  `${OPEN_TAG}[\\s\\S]*?${CLOSE_TAG.replace('/', '\\/')}`,
  'g',
);

/** Strip model-internal artifacts (e.g. chain-of-thought wrappers) from user-facing text. */
export function stripModelArtifacts(text: string): string {
  return text.replace(REDACTED_THINKING_PATTERN, '').trim();
}
