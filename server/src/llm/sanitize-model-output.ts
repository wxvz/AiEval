const THINKING_WRAPPERS = [
  { open: '<think>', close: '</think>' },
  { open: '<thinking>', close: '</thinking>' },
] as const;

/** High-confidence markers that the model dumped self-check meta instead of an answer. */
const REASONING_META_MARKERS = [
  /self-correction\s*\/\s*verification/i,
  /all constraints met/i,
  /output matches (exactly|the refined draft|response)/i,
  /during thought\s*:/i,
  /✅\s*proceeds/i,
  /final check of the prompt\s*:/i,
];

/** Lines produced by guard / content-safety classifiers (not chat models). */
const SAFETY_CLASSIFIER_LINE =
  /^(?:user|response)\s+safety\s*:\s*(?:safe|unsafe)\s*$/i;
const SAFETY_CATEGORIES_LINE = /^safety\s+categories\s*:/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * When an open thinking tag never closes, keep any preface before it.
 * If the whole reply is inside the unclosed block, keep the trailing segment
 * after the last blank line (common "reasoning then answer" shape).
 */
function stripUnclosedOpen(text: string, openPattern: string): string {
  const match = new RegExp(openPattern, 'i').exec(text);

  if (!match) {
    return text;
  }

  const prefix = text.slice(0, match.index).trim();

  if (prefix) {
    return prefix;
  }

  const inner = text.slice(match.index + match[0].length);
  const segments = inner.split(/\n\s*\n/);

  if (segments.length < 2) {
    return '';
  }

  return (segments[segments.length - 1] ?? '').trim();
}

/**
 * Untagged verification dumps (common when thinking models truncate mid-check)
 * are not scorable answers — treat as empty so generation can fall back.
 */
function isReasoningMetaDump(text: string): boolean {
  const markerHits = REASONING_META_MARKERS.filter((re) => re.test(text)).length;

  if (markerHits >= 2) {
    return true;
  }

  // One strong marker plus checklist-style arrows is enough.
  if (markerHits >= 1 && (text.match(/->/g)?.length ?? 0) >= 3) {
    return true;
  }

  return false;
}

/**
 * True when the whole reply is a content-safety verdict (e.g. Nemotron Content Safety
 * via OpenRouter `openrouter/free`), not a scorable task answer.
 */
export function isSafetyClassifierOutput(text: string): boolean {
  const lines = text
    .trim()
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0 || lines.length > 8) {
    return false;
  }

  let safetyLines = 0;

  for (const line of lines) {
    if (SAFETY_CLASSIFIER_LINE.test(line) || SAFETY_CATEGORIES_LINE.test(line)) {
      safetyLines += 1;
      continue;
    }

    return false;
  }

  return safetyLines >= 1;
}

/** Models that classify safety / moderate content — unsuitable as answer generators. */
export function isUnusableAnswerModel(model: string): boolean {
  const id = model.toLowerCase();

  return (
    id.includes('content-safety') ||
    id.includes('llama-guard') ||
    id.includes('prompt-guard') ||
    /nemotron[\w./-]*safety/.test(id) ||
    /(^|\/)moderation(\/|:|$)/.test(id)
  );
}

/** Strip model-internal artifacts (e.g. chain-of-thought wrappers) from user-facing text. */
export function stripModelArtifacts(text: string): string {
  let result = text;

  for (const { open, close } of THINKING_WRAPPERS) {
    const openPattern = escapeRegExp(open);
    const closePattern = escapeRegExp(close);

    // Closed blocks first (non-greedy so multiple pairs each strip).
    result = result.replace(new RegExp(`${openPattern}[\\s\\S]*?${closePattern}`, 'gi'), '');
    result = stripUnclosedOpen(result, openPattern);
  }

  result = result.trim();

  if (result && isReasoningMetaDump(result)) {
    return '';
  }

  if (result && isSafetyClassifierOutput(result)) {
    return '';
  }

  return result;
}
