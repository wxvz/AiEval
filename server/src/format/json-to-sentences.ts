function labelFromKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
}

export function jsonToSentences(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return '';
    }

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return jsonToSentences(JSON.parse(trimmed) as unknown);
      } catch {
        return trimmed;
      }
    }

    return trimmed;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => jsonToSentences(entry))
      .filter((entry) => entry.length > 0)
      .join(' ');
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => {
        const text = jsonToSentences(entry);

        if (!text) {
          return '';
        }

        return `${labelFromKey(key)}: ${text}.`;
      })
      .filter((entry) => entry.length > 0)
      .join(' ');
  }

  return String(value);
}
