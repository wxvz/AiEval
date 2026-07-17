const THINKING_WRAPPERS = [
  { open: '<think>', close: '</think>' },
  { open: '<thinking>', close: '</thinking>' },
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Strip model-internal artifacts (e.g. chain-of-thought wrappers) from user-facing text. */
export function stripModelArtifacts(text: string): string {
  let result = text;

  for (const { open, close } of THINKING_WRAPPERS) {
    const openPattern = escapeRegExp(open);
    const closePattern = escapeRegExp(close);

    // Closed blocks first (non-greedy so multiple pairs each strip).
    result = result.replace(new RegExp(`${openPattern}[\\s\\S]*?${closePattern}`, 'gi'), '');
    // Unclosed open tag: drop the truncated reasoning through EOF.
    result = result.replace(new RegExp(`${openPattern}[\\s\\S]*$`, 'i'), '');
  }

  return result.trim();
}
