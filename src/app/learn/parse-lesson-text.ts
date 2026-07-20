import { isLearnGlossaryTerm, type LearnGlossaryTerm } from './learn-glossary';

export type LessonTextEmphasis = 'bold' | 'italic';

export type LessonTextSegment =
  | { kind: 'text'; text: string; emphasis?: LessonTextEmphasis }
  | { kind: 'term'; term: LearnGlossaryTerm; emphasis?: LessonTextEmphasis };

const TERM_PATTERN = /\{\{(\w+)\}\}/g;
/** Non-empty bold span; non-greedy so adjacent markers stay separate. */
const BOLD_PATTERN = /\*\*(.+?)\*\*/;
/** Italic `*…*` that is not part of `**`. */
const ITALIC_PATTERN = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/;

type Emphasis = LessonTextEmphasis | undefined;

type MarkerMatch =
  | { type: 'term'; start: number; end: number; key: string }
  | { type: 'bold' | 'italic'; start: number; end: number; inner: string };

function withEmphasis<T extends LessonTextSegment>(segment: T, emphasis: Emphasis): T {
  if (!emphasis) {
    return segment;
  }
  return { ...segment, emphasis };
}

/** Split on `{{term}}` only; used inside bold/italic spans. */
function parseTermsOnly(text: string, emphasis: Emphasis): LessonTextSegment[] {
  const segments: LessonTextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(TERM_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push(withEmphasis({ kind: 'text', text: text.slice(lastIndex, index) }, emphasis));
    }

    const termKey = match[1] ?? '';
    if (isLearnGlossaryTerm(termKey)) {
      segments.push(withEmphasis({ kind: 'term', term: termKey }, emphasis));
    } else {
      segments.push(withEmphasis({ kind: 'text', text: match[0] }, emphasis));
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push(withEmphasis({ kind: 'text', text: text.slice(lastIndex) }, emphasis));
  }

  return segments.length > 0 ? segments : [withEmphasis({ kind: 'text', text }, emphasis)];
}

function findEarliestMarker(text: string): MarkerMatch | null {
  const candidates: MarkerMatch[] = [];

  const termMatch = text.matchAll(TERM_PATTERN).next().value as RegExpMatchArray | undefined;
  if (termMatch && termMatch.index !== undefined) {
    candidates.push({
      type: 'term',
      start: termMatch.index,
      end: termMatch.index + termMatch[0].length,
      key: termMatch[1] ?? '',
    });
  }

  const boldMatch = BOLD_PATTERN.exec(text);
  if (boldMatch && boldMatch.index !== undefined && (boldMatch[1]?.length ?? 0) > 0) {
    candidates.push({
      type: 'bold',
      start: boldMatch.index,
      end: boldMatch.index + boldMatch[0].length,
      inner: boldMatch[1] ?? '',
    });
  }

  const italicMatch = ITALIC_PATTERN.exec(text);
  if (italicMatch && italicMatch.index !== undefined && (italicMatch[1]?.length ?? 0) > 0) {
    candidates.push({
      type: 'italic',
      start: italicMatch.index,
      end: italicMatch.index + italicMatch[0].length,
      inner: italicMatch[1] ?? '',
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => a.start - b.start);
  return candidates[0] ?? null;
}

/**
 * Parse lesson/chat inline markup: `{{glossaryTerm}}`, `**bold**`, and `*italic*`.
 * Unmatched markers stay literal. Emphasis does not nest; markers inside a span
 * are only glossary terms.
 */
export function parseLessonText(text: string): LessonTextSegment[] {
  const segments: LessonTextSegment[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const marker = findEarliestMarker(remaining);
    if (!marker) {
      segments.push({ kind: 'text', text: remaining });
      break;
    }

    if (marker.start > 0) {
      segments.push({ kind: 'text', text: remaining.slice(0, marker.start) });
    }

    if (marker.type === 'term') {
      if (isLearnGlossaryTerm(marker.key)) {
        segments.push({ kind: 'term', term: marker.key });
      } else {
        segments.push({ kind: 'text', text: remaining.slice(marker.start, marker.end) });
      }
    } else {
      segments.push(...parseTermsOnly(marker.inner, marker.type));
    }

    remaining = remaining.slice(marker.end);
  }

  return segments.length > 0 ? segments : [{ kind: 'text', text }];
}
