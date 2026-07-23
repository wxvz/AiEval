import { cosineSimilarity } from '../utils/retrieval/similarity';
import { getLesson, LEARN_LESSONS, type LearnLessonMeta } from './curriculum';
import { loadLessonContent } from './learn-content';
import { LEARN_GLOSSARY, type LearnGlossaryTerm } from './learn-glossary';

/** Keyword max score at or below this triggers bag-of-words embedding re-rank. */
const KEYWORD_PLATEAU_MAX = 1;
/** Page excerpts at or below this max keyword score may lose to cross-lesson matches. */
const WEAK_PAGE_SCORE_MAX = 1;
const MAX_CROSS_LESSON_CANDIDATES = 3;

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

export interface TutorCatalogEntry {
  title: string;
  route: string;
}

export interface TutorExcerptResult {
  excerpts: TutorExcerpt[];
  sources: TutorCatalogEntry[];
  /** Term senses from a cross-lesson match when the current page has none. */
  relatedTermHints: TutorTermHint[];
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
/** Per-excerpt cap — must match server `MAX_EXCERPT_TEXT` in learn-chat.ts. */
const MAX_EXCERPT_TEXT = 600;
const MAX_EXCERPT_CHARS = MAX_EXCERPTS * MAX_EXCERPT_TEXT;

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

function termHintsForLesson(contentLessonId: string | null, lessonId: string | null): TutorTermHint[] {
  const hintKey =
    contentLessonId && LESSON_TERM_HINTS[contentLessonId] ? contentLessonId : lessonId;
  const termIds =
    (hintKey ? LESSON_TERM_HINTS[hintKey] : undefined) ??
    (contentLessonId ? LESSON_TERM_HINTS[contentLessonId] : undefined) ??
    [];

  return termIds.map((id) => {
    const entry = LEARN_GLOSSARY[id];
    return {
      term: id,
      label: entry.label,
      sense: entry.explanation,
    };
  });
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

  return {
    lessonId,
    contentLessonId,
    lessonTitle: meta?.title ?? null,
    lessonSummary: meta?.summary ?? null,
    route: meta?.route ?? null,
    termHints: termHintsForLesson(contentLessonId, lessonId),
  };
}

/** Live curriculum titles/routes the tutor may cite (never invent outside this list). */
export function getTutorCurriculumCatalog(): TutorCatalogEntry[] {
  return LEARN_LESSONS.filter((lesson) => lesson.status === 'live').map((lesson) => ({
    title: lesson.title,
    route: lesson.route,
  }));
}

/** Keep only sources that match a known live lesson title or route. */
export function filterKnownTutorSources(
  sources: Array<{ title?: string; route?: string }>,
  catalog: TutorCatalogEntry[] = getTutorCurriculumCatalog(),
): TutorCatalogEntry[] {
  const byRoute = new Map(catalog.map((entry) => [entry.route, entry]));
  const byTitle = new Map(catalog.map((entry) => [entry.title.toLowerCase(), entry]));
  const filtered: TutorCatalogEntry[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    const route = source.route?.trim();
    const title = source.title?.trim();
    const match =
      (route ? byRoute.get(route) : undefined) ??
      (title ? byTitle.get(title.toLowerCase()) : undefined);
    if (!match || seen.has(match.route)) {
      continue;
    }
    seen.add(match.route);
    filtered.push(match);
    if (filtered.length >= 5) {
      break;
    }
  }
  return filtered;
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

/** Sparse bag-of-words vector over a shared vocabulary (local embedding stand-in). */
function bagOfWordsVector(tokens: string[], vocab: Map<string, number>): number[] {
  const vector = new Array<number>(vocab.size).fill(0);
  for (const token of tokens) {
    const index = vocab.get(token);
    if (index !== undefined) {
      vector[index] = (vector[index] ?? 0) + 1;
    }
  }
  return vector;
}

function buildVocab(tokenLists: string[][]): Map<string, number> {
  const vocab = new Map<string, number>();
  for (const tokens of tokenLists) {
    for (const token of tokens) {
      if (!vocab.has(token)) {
        vocab.set(token, vocab.size);
      }
    }
  }
  return vocab;
}

/**
 * When keyword overlap plateaus, re-rank with bag-of-words cosine similarity.
 * Keeps AiEval lesson text as the source of truth (no external embedding API).
 */
function applyEmbeddingRerank(
  chunks: Array<TutorExcerpt & { score: number; order: number; tokens: string[] }>,
  queryTokens: string[],
): void {
  const vocab = buildVocab([queryTokens, ...chunks.map((chunk) => chunk.tokens)]);
  if (vocab.size === 0) {
    return;
  }
  const queryVector = bagOfWordsVector(queryTokens, vocab);
  for (const chunk of chunks) {
    const similarity = cosineSimilarity(queryVector, bagOfWordsVector(chunk.tokens, vocab));
    // Preserve soft baseline for the first paragraph.
    chunk.score = similarity + (chunk.order === 0 ? 0.05 : 0);
  }
}

type ScoredChunk = TutorExcerpt & { score: number; order: number; tokens: string[] };

function collectLessonChunks(contentId: string): ScoredChunk[] {
  const content = loadLessonContent(contentId);
  if (!content) {
    return [];
  }

  const chunks: ScoredChunk[] = [];
  let order = 0;

  const pushChunk = (text: string, heading: string | undefined): void => {
    chunks.push({
      text,
      heading,
      score: 0,
      order: order++,
      tokens: tokenize(text),
    });
  };

  for (const section of content.sections) {
    const heading = section.heading || section.title;
    for (const paragraph of section.paragraphs ?? []) {
      const text = stripGlossaryMarkers(paragraph);
      if (text) {
        pushChunk(text, heading || undefined);
      }
    }
    for (const bullet of section.bullets ?? []) {
      const text = stripGlossaryMarkers(bullet);
      if (text) {
        pushChunk(text, heading || undefined);
      }
    }
    if (section.check?.explanation) {
      const text = stripGlossaryMarkers(section.check.explanation);
      if (text) {
        pushChunk(text, heading || undefined);
      }
    }
  }

  for (const question of content.recapQuestions ?? []) {
    if (question.explanation) {
      const text = stripGlossaryMarkers(question.explanation);
      if (text) {
        pushChunk(text, 'Recap');
      }
    }
  }

  return chunks;
}

function selectTopExcerpts(chunks: ScoredChunk[], query: string): {
  excerpts: TutorExcerpt[];
  maxKeywordScore: number;
} {
  if (chunks.length === 0) {
    return { excerpts: [], maxKeywordScore: 0 };
  }

  const queryTokenList = tokenize(query);
  const queryTokens = new Set(queryTokenList);
  for (const chunk of chunks) {
    let score = 0;
    for (const token of chunk.tokens) {
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

  const maxKeywordScore = chunks.reduce((max, chunk) => Math.max(max, chunk.score), 0);
  if (maxKeywordScore <= KEYWORD_PLATEAU_MAX) {
    applyEmbeddingRerank(chunks, queryTokenList);
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
    const text = chunk.text.slice(0, MAX_EXCERPT_TEXT);
    const nextLen = totalChars + text.length;
    if (nextLen > MAX_EXCERPT_CHARS && selected.length > 0) {
      continue;
    }
    selected.push({ text, heading: chunk.heading });
    totalChars = nextLen;
    if (totalChars >= MAX_EXCERPT_CHARS) {
      break;
    }
  }

  // Guarantee at least the first paragraph when nothing scored.
  if (selected.length === 0 && chunks[0]) {
    selected.push({
      text: chunks[0].text.slice(0, MAX_EXCERPT_TEXT),
      heading: chunks[0].heading,
    });
  }

  return { excerpts: selected, maxKeywordScore };
}

function excerptsForContentLesson(
  contentId: string,
  query: string,
): TutorExcerptResult & { maxKeywordScore: number } {
  const contentMeta = getLesson(contentId);
  const sources: TutorCatalogEntry[] =
    contentMeta?.route && contentMeta.title
      ? [{ title: contentMeta.title, route: contentMeta.route }]
      : [];
  const chunks = collectLessonChunks(contentId);
  if (chunks.length === 0) {
    return { excerpts: [], sources, relatedTermHints: [], maxKeywordScore: 0 };
  }

  const { excerpts, maxKeywordScore } = selectTopExcerpts(chunks, query);
  return {
    excerpts,
    sources,
    relatedTermHints: termHintsForLesson(contentId, contentId),
    maxKeywordScore,
  };
}

function scoreLessonAgainstQuery(lesson: LearnLessonMeta, queryTokens: Set<string>): number {
  let score = 0;
  for (const token of tokenize(`${lesson.title} ${lesson.summary}`)) {
    if (queryTokens.has(token)) {
      score += 1;
    }
  }

  const termIds = LESSON_TERM_HINTS[lesson.id] ?? [];
  for (const termId of termIds) {
    const entry = LEARN_GLOSSARY[termId];
    const labelTokens = tokenize(entry.label);
    const idTokens = tokenize(termId.replace(/([a-z])([A-Z])/g, '$1 $2'));
    for (const token of [...labelTokens, ...idTokens, termId.toLowerCase()]) {
      if (queryTokens.has(token)) {
        score += 2;
      }
    }
  }

  return score;
}

function contentLessonsForSearch(): LearnLessonMeta[] {
  return LEARN_LESSONS.filter(
    (lesson) => lesson.status === 'live' && Boolean(lesson.contentFile) && loadLessonContent(lesson.id),
  );
}

/**
 * Rank plain-text chunks from the current (or parent) lesson against the learner query.
 * When the page has no content or only weak keyword overlap, fall back to other live lessons.
 * Always soft-includes the first paragraph when on-page content exists.
 * Falls back to bag-of-words embeddings when keyword scores plateau.
 */
export function getTutorExcerpts(lessonId: string | null, query: string): TutorExcerptResult {
  const grounding = getTutorPageGrounding(lessonId);
  const contentId = grounding.contentLessonId;
  const pageResult = contentId
    ? excerptsForContentLesson(contentId, query)
    : { excerpts: [] as TutorExcerpt[], sources: [] as TutorCatalogEntry[], relatedTermHints: [] as TutorTermHint[], maxKeywordScore: 0 };

  const pageStrong =
    pageResult.excerpts.length > 0 && pageResult.maxKeywordScore > WEAK_PAGE_SCORE_MAX;
  if (pageStrong) {
    return {
      excerpts: pageResult.excerpts,
      sources: pageResult.sources,
      relatedTermHints: [],
    };
  }

  const queryTokens = new Set(tokenize(query));
  const candidates = contentLessonsForSearch()
    .filter((lesson) => lesson.id !== contentId)
    .map((lesson) => ({
      lesson,
      score: scoreLessonAgainstQuery(lesson, queryTokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CROSS_LESSON_CANDIDATES);

  let bestCross: (TutorExcerptResult & { maxKeywordScore: number }) | null = null;
  for (const candidate of candidates) {
    const result = excerptsForContentLesson(candidate.lesson.id, query);
    if (result.excerpts.length === 0) {
      continue;
    }
    if (!bestCross || result.maxKeywordScore > bestCross.maxKeywordScore) {
      bestCross = result;
    }
  }

  if (bestCross && bestCross.maxKeywordScore > pageResult.maxKeywordScore) {
    return {
      excerpts: bestCross.excerpts,
      sources: bestCross.sources,
      relatedTermHints: grounding.termHints.length ? [] : bestCross.relatedTermHints,
    };
  }

  if (pageResult.excerpts.length > 0) {
    return {
      excerpts: pageResult.excerpts,
      sources: pageResult.sources,
      relatedTermHints: [],
    };
  }

  if (bestCross) {
    return {
      excerpts: bestCross.excerpts,
      sources: bestCross.sources,
      relatedTermHints: grounding.termHints.length ? [] : bestCross.relatedTermHints,
    };
  }

  return { excerpts: [], sources: pageResult.sources, relatedTermHints: [] };
}
