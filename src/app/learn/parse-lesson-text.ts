import { isLearnGlossaryTerm, type LearnGlossaryTerm } from './learn-glossary';

export type LessonTextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'term'; term: LearnGlossaryTerm };

const TERM_PATTERN = /\{\{(\w+)\}\}/g;

export function parseLessonText(text: string): LessonTextSegment[] {
  const segments: LessonTextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(TERM_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ kind: 'text', text: text.slice(lastIndex, index) });
    }

    const termKey = match[1] ?? '';
    if (isLearnGlossaryTerm(termKey)) {
      segments.push({ kind: 'term', term: termKey });
    } else {
      segments.push({ kind: 'text', text: match[0] });
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: 'text', text: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ kind: 'text', text }];
}
