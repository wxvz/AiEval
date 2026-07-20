import { getLesson } from './curriculum';
import { loadLessonContent } from './learn-content';
import { LEARN_GLOSSARY, type LearnGlossaryTerm } from './learn-glossary';

export interface TutorTermHint {
  term: string;
  label: string;
  sense: string;
}

export interface TutorPageGrounding {
  lessonId: string | null;
  contentLessonId: string | null;
  lessonTitle: string | null;
  lessonSummary: string | null;
  route: string | null;
  termHints: TutorTermHint[];
}

export interface TutorExcerpt {
  text: string;
  heading?: string;
}

export interface TutorExcerptResult {
  excerpts: TutorExcerpt[];
  sources: { title: string; route: string }[];
}

/** Overloaded lessons only — glossary senses the tutor must prefer on that page. */
const LESSON_TERM_HINTS: Record<string, LearnGlossaryTerm[]> = {
  'bias-and-weights': ['bias', 'weights'],
  'deep-learning-approaches': ['inductiveBias'],
  'controlling-generation': ['temperature', 'topP', 'maxTokens'],
  'semantic-memory': ['semanticMemory', 'retrieval', 'embedding'],
  'train-vs-test': ['memorization'],
  'data-literacy': ['memorization'],
  'faithfulness-and-hallucinations': ['hallucination', 'faithfulness'],
};

const MAX_EXCERPTS = 5;
const MAX_EXCERPT_CHARS = 1800;

/** Resolve lab → parent read lesson when the lab has no contentFile. */
export function resolveContentLessonId(lessonId: string | null): string | null {
  if (!lessonId) {
    return null;
  }
  const meta = getLesson(lessonId);
  if (!meta) {
    return lessonId;
  }
  if (meta.contentFile) {
    return meta.id;
  }
  if (meta.parentLessonId) {
    return meta.parentLessonId;
  }
  return meta.id;
}

export function getTutorPageGrounding(lessonId: string | null): TutorPageGrounding {
  if (!lessonId) {
    return {
      lessonId: null,
      contentLessonId: null,
      lessonTitle: null,
      lessonSummary: null,
      route: null,
      termHints: [],
    };
  }

  const meta = getLesson(lessonId);
  const contentLessonId = resolveContentLessonId(lessonId);
  const hintKey = contentLessonId && LESSON_TERM_HINTS[contentLessonId] ? contentLessonId : lessonId;
  const termIds = LESSON_TERM_HINTS[hintKey] ?? (contentLessonId ? LESSON_TERM_HINTS[contentLessonId] : undefined) ?? [];

  const termHints: TutorTermHint[] = termIds.map((id) => {
    const entry = LEARN_GLOSSARY[id];
    return {
      term: id,
      label: entry.label,
      sense: entry.explanation,
    };
  });

  return {
    lessonId,
    contentLessonId,
    lessonTitle: meta?.title ?? null,
    lessonSummary: meta?.summary ?? null,
    route: meta?.route ?? null,
    termHints,
  };
}

function stripGlossaryMarkers(text: string): string {
  return text.replace(/\{\{(\w+)\}\}/g, '$1').replace(/\s+/g, ' ').trim();
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

/**
 * Rank plain-text chunks from the current (or parent) lesson against the learner query.
 * Always soft-includes the first paragraph when content exists.
 */
export function getTutorExcerpts(lessonId: string | null, query: string): TutorExcerptResult {
  const grounding = getTutorPageGrounding(lessonId);
  const contentId = grounding.contentLessonId;
  const contentMeta = contentId ? getLesson(contentId) : null;
  const sources =
    contentMeta?.route && contentMeta.title
      ? [{ title: contentMeta.title, route: contentMeta.route }]
      : [];

  if (!contentId) {
    return { excerpts: [], sources };
  }

  const content = loadLessonContent(contentId);
  if (!content) {
    return { excerpts: [], sources };
  }

  type Scored = TutorExcerpt & { score: number; order: number };
  const chunks: Scored[] = [];
  let order = 0;

  for (const section of content.sections) {
    const heading = section.heading || section.title;
    for (const paragraph of section.paragraphs ?? []) {
      const text = stripGlossaryMarkers(paragraph);
      if (text) {
        chunks.push({ text, heading: heading || undefined, score: 0, order: order++ });
      }
    }
    for (const bullet of section.bullets ?? []) {
      const text = stripGlossaryMarkers(bullet);
      if (text) {
        chunks.push({ text, heading: heading || undefined, score: 0, order: order++ });
      }
    }
    if (section.check?.explanation) {
      const text = stripGlossaryMarkers(section.check.explanation);
      if (text) {
        chunks.push({ text, heading: heading || undefined, score: 0, order: order++ });
      }
    }
  }

  for (const question of content.recapQuestions ?? []) {
    if (question.explanation) {
      const text = stripGlossaryMarkers(question.explanation);
      if (text) {
        chunks.push({ text, heading: 'Recap', score: 0, order: order++ });
      }
    }
  }

  if (chunks.length === 0) {
    return { excerpts: [], sources };
  }

  const queryTokens = new Set(tokenize(query));
  for (const chunk of chunks) {
    const chunkTokens = tokenize(chunk.text);
    let score = 0;
    for (const token of chunkTokens) {
      if (queryTokens.has(token)) {
        score += 1;
      }
    }
    // Soft baseline: keep early lesson framing available.
    if (chunk.order === 0) {
      score += 0.5;
    }
    chunk.score = score;
  }

  chunks.sort((a, b) => b.score - a.score || a.order - b.order);

  const selected: TutorExcerpt[] = [];
  let totalChars = 0;
  for (const chunk of chunks) {
    if (selected.length >= MAX_EXCERPTS) {
      break;
    }
    if (chunk.score <= 0 && selected.length > 0) {
      break;
    }
    const nextLen = totalChars + chunk.text.length;
    if (nextLen > MAX_EXCERPT_CHARS && selected.length > 0) {
      continue;
    }
    selected.push({ text: chunk.text, heading: chunk.heading });
    totalChars = nextLen;
    if (totalChars >= MAX_EXCERPT_CHARS) {
      break;
    }
  }

  // Guarantee at least the first paragraph when nothing scored.
  if (selected.length === 0 && chunks[0]) {
    selected.push({ text: chunks[0].text, heading: chunks[0].heading });
  }

  return { excerpts: selected, sources };
}
