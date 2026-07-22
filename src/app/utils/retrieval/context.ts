export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function assembleContext(chunks: { text: string }[], maxChars: number): string {
  if (maxChars <= 0 || chunks.length === 0) {
    return '';
  }

  const parts: string[] = [];
  let used = 0;

  for (const chunk of chunks) {
    const separator = parts.length > 0 ? '\n\n' : '';
    const next = `${separator}${chunk.text}`;
    if (used + next.length > maxChars) {
      const remaining = maxChars - used - separator.length;
      if (remaining > 0 && separator.length === 0) {
        parts.push(chunk.text.slice(0, remaining));
      } else if (remaining > 0) {
        parts.push(chunk.text.slice(0, remaining));
      }
      break;
    }
    parts.push(parts.length === 0 ? chunk.text : next.slice(separator.length));
    used += next.length;
  }

  return parts.join('\n\n');
}
