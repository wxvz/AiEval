export type LearnTrackId = 'foundation' | 'llm-systems' | 'go-deeper';
export type LessonKind = 'read' | 'interactive' | 'tool';
export type LessonStatus = 'live' | 'planned';

export interface LearnTrack {
  id: LearnTrackId;
  title: string;
}

export interface LearnLessonMeta {
  id: string;
  trackId: LearnTrackId;
  order: number;
  title: string;
  summary: string;
  kind: LessonKind;
  status: LessonStatus;
  prerequisites: string[];
  route: string;
  contentFile: string | null;
  /** Optional mini-lab: reachable from a read lesson, hidden from hub track list and Continue flow. */
  optional?: boolean;
  /** Read lesson id that surfaces the optional lab link. */
  parentLessonId?: string;
}

export const LEARN_TRACKS: LearnTrack[] = [
  { id: 'foundation', title: 'Foundation' },
  { id: 'llm-systems', title: 'LLM systems' },
  { id: 'go-deeper', title: 'Go deeper' },
];

export const LEARN_LESSONS: LearnLessonMeta[] = [
  {
    id: 'learning-from-examples',
    trackId: 'foundation',
    order: 1,
    title: 'Learning from examples',
    summary: 'Supervised learning: show inputs, teach targets, improve over time.',
    kind: 'read',
    status: 'live',
    prerequisites: [],
    route: '/learn/lessons/learning-from-examples',
    contentFile: 'learning-from-examples.json',
  },
  {
    id: 'train-vs-test',
    trackId: 'foundation',
    order: 2,
    title: 'Train vs test',
    summary: 'Why we hold data back to check real generalization.',
    kind: 'read',
    status: 'live',
    prerequisites: ['learning-from-examples'],
    route: '/learn/lessons/train-vs-test',
    contentFile: 'train-vs-test.json',
  },
  {
    id: 'train-vs-test-lab',
    trackId: 'foundation',
    order: 1,
    title: 'Train vs test lab',
    summary: 'Hold out one XOR corner and compare train vs test accuracy.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['train-vs-test'],
    route: '/learn/labs/train-vs-test',
    contentFile: null,
    optional: true,
    parentLessonId: 'train-vs-test',
  },
  {
    id: 'loss-and-updates',
    trackId: 'foundation',
    order: 3,
    title: 'Loss and updates',
    summary: 'Measuring wrongness and nudging weights to reduce it.',
    kind: 'read',
    status: 'live',
    prerequisites: ['train-vs-test'],
    route: '/learn/lessons/loss-and-updates',
    contentFile: 'loss-and-updates.json',
  },
  {
    id: 'loss-and-updates-lab',
    trackId: 'foundation',
    order: 2,
    title: 'Loss and updates lab',
    summary: 'Train on XOR and watch loss fall while predictions improve.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['loss-and-updates'],
    route: '/learn/labs/loss-and-updates',
    contentFile: null,
    optional: true,
    parentLessonId: 'loss-and-updates',
  },
  {
    id: 'neural-network-lab',
    trackId: 'foundation',
    order: 4,
    title: 'Neural network lab',
    summary: 'Train a tiny network on puzzles like XOR.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['loss-and-updates'],
    route: '/learn/labs/neural-network',
    contentFile: null,
  },
  {
    id: 'prompts-as-instructions',
    trackId: 'llm-systems',
    order: 1,
    title: 'Prompts as instructions',
    summary: 'Condition a language model with clear task wording.',
    kind: 'read',
    status: 'live',
    prerequisites: ['neural-network-lab'],
    route: '/learn/lessons/prompts-as-instructions',
    contentFile: 'prompts-as-instructions.json',
  },
  {
    id: 'controlling-generation',
    trackId: 'llm-systems',
    order: 2,
    title: 'Controlling generation',
    summary: 'Temperature, top-p, and max tokens — lock sampling for fair comparisons.',
    kind: 'read',
    status: 'live',
    prerequisites: ['prompts-as-instructions'],
    route: '/learn/lessons/controlling-generation',
    contentFile: 'controlling-generation.json',
  },
  {
    id: 'controlling-generation-lab',
    trackId: 'llm-systems',
    order: 2,
    title: 'Generation variance lab',
    summary: 'See how temperature changes answer variety on the same prompt.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['controlling-generation'],
    route: '/learn/labs/controlling-generation',
    contentFile: null,
    optional: true,
    parentLessonId: 'controlling-generation',
  },
  {
    id: 'comparing-answers',
    trackId: 'llm-systems',
    order: 3,
    title: 'Comparing answers',
    summary: 'Same prompt, multiple models — judge which response is stronger.',
    kind: 'read',
    status: 'live',
    prerequisites: ['controlling-generation'],
    route: '/learn/lessons/comparing-answers',
    contentFile: 'comparing-answers.json',
  },
  {
    id: 'golden-test-cases',
    trackId: 'llm-systems',
    order: 4,
    title: 'Golden test cases',
    summary: 'Reusable prompts and failure modes beat one-off ad-hoc checks.',
    kind: 'read',
    status: 'live',
    prerequisites: ['comparing-answers'],
    route: '/learn/lessons/golden-test-cases',
    contentFile: 'golden-test-cases.json',
  },
  {
    id: 'rubrics-and-criteria',
    trackId: 'llm-systems',
    order: 5,
    title: 'Rubrics and criteria',
    summary: 'Break quality into scorable rows with clear anchors.',
    kind: 'read',
    status: 'live',
    prerequisites: ['golden-test-cases'],
    route: '/learn/lessons/rubrics-and-criteria',
    contentFile: 'rubrics-and-criteria.json',
  },
  {
    id: 'structured-outputs-for-judges',
    trackId: 'llm-systems',
    order: 6,
    title: 'Structured outputs for judges',
    summary: 'Judge models must return parseable JSON scores per criterion.',
    kind: 'read',
    status: 'live',
    prerequisites: ['rubrics-and-criteria'],
    route: '/learn/lessons/structured-outputs-for-judges',
    contentFile: 'structured-outputs-for-judges.json',
  },
  {
    id: 'judge-json-lab',
    trackId: 'llm-systems',
    order: 6,
    title: 'Judge JSON lab',
    summary: 'Spot valid judge JSON and common parse failures.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['structured-outputs-for-judges'],
    route: '/learn/labs/judge-json',
    contentFile: null,
    optional: true,
    parentLessonId: 'structured-outputs-for-judges',
  },
  {
    id: 'semantic-memory',
    trackId: 'llm-systems',
    order: 7,
    title: 'Semantic memory',
    summary: 'Store knowledge outside the model and fetch the right passages by meaning.',
    kind: 'read',
    status: 'live',
    prerequisites: ['structured-outputs-for-judges'],
    route: '/learn/lessons/semantic-memory',
    contentFile: 'semantic-memory.json',
  },
  {
    id: 'semantic-memory-lab',
    trackId: 'llm-systems',
    order: 7,
    title: 'Semantic memory practice',
    summary: 'Rank three teaching chunks by meaning with a fixed query.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['semantic-memory'],
    route: '/learn/labs/semantic-memory',
    contentFile: null,
    optional: true,
    parentLessonId: 'semantic-memory',
  },
  {
    id: 'semantic-search-lab',
    trackId: 'llm-systems',
    order: 8,
    title: 'Semantic search lab',
    summary: 'See how embeddings rank text chunks by meaning.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['semantic-memory'],
    route: '/learn/labs/semantic-search',
    contentFile: null,
  },
  {
    id: 'rag-playground-lab',
    trackId: 'llm-systems',
    order: 9,
    title: 'RAG playground',
    summary: 'Retrieve chunks, assemble context, and preview a stub answer.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['semantic-search-lab'],
    route: '/learn/labs/rag-playground',
    contentFile: null,
  },
  {
    id: 'faithfulness-and-hallucinations',
    trackId: 'llm-systems',
    order: 10,
    title: 'Faithfulness and hallucinations',
    summary: 'Ground answers in retrieved context; spot invented facts.',
    kind: 'read',
    status: 'live',
    prerequisites: ['rag-playground-lab'],
    route: '/learn/lessons/faithfulness-and-hallucinations',
    contentFile: 'faithfulness-and-hallucinations.json',
  },
  {
    id: 'faithfulness-lab',
    trackId: 'llm-systems',
    order: 10,
    title: 'Faithfulness lab',
    summary: 'Mark which answer sentences are supported by the provided context.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['faithfulness-and-hallucinations'],
    route: '/learn/labs/faithfulness',
    contentFile: null,
    optional: true,
    parentLessonId: 'faithfulness-and-hallucinations',
  },
  {
    id: 'first-evaluation-lab',
    trackId: 'llm-systems',
    order: 11,
    title: 'First evaluation lab',
    summary: 'Walk through creating and comparing an evaluation in AiEval.',
    kind: 'tool',
    status: 'live',
    prerequisites: ['faithfulness-and-hallucinations'],
    route: '/learn/labs/first-evaluation',
    contentFile: null,
  },
  {
    id: 'regression-evals',
    trackId: 'llm-systems',
    order: 12,
    title: 'Regression evals',
    summary: 'Re-run a golden set after changes to catch quality drops.',
    kind: 'read',
    status: 'live',
    prerequisites: ['first-evaluation-lab'],
    route: '/learn/lessons/regression-evals',
    contentFile: 'regression-evals.json',
  },
  {
    id: 'automation-and-judges',
    trackId: 'llm-systems',
    order: 13,
    title: 'Automation and judges',
    summary: 'When AI scores answers for you — and when to double-check.',
    kind: 'read',
    status: 'live',
    prerequisites: ['regression-evals'],
    route: '/learn/lessons/automation-and-judges',
    contentFile: 'automation-and-judges.json',
  },
  {
    id: 'transformers-overview',
    trackId: 'go-deeper',
    order: 1,
    title: 'Transformers',
    summary: 'Attention, tokens, and next-token prediction.',
    kind: 'read',
    status: 'live',
    prerequisites: ['automation-and-judges'],
    route: '/learn/lessons/transformers-overview',
    contentFile: 'transformers-overview.json',
  },
  {
    id: 'production-concerns',
    trackId: 'go-deeper',
    order: 2,
    title: 'Production concerns',
    summary: 'Cost, latency, monitoring, and safety at scale.',
    kind: 'read',
    status: 'live',
    prerequisites: ['transformers-overview'],
    route: '/learn/lessons/production-concerns',
    contentFile: 'production-concerns.json',
  },
  {
    id: 'building-eval-harnesses',
    trackId: 'go-deeper',
    order: 3,
    title: 'Building eval harnesses',
    summary: 'How tools like AiEval wire generate, score, and improve.',
    kind: 'read',
    status: 'live',
    prerequisites: ['production-concerns'],
    route: '/learn/lessons/building-eval-harnesses',
    contentFile: 'building-eval-harnesses.json',
  },
];

const TRACK_ORDER: LearnTrackId[] = ['foundation', 'llm-systems', 'go-deeper'];

const LIVE_LESSON_ORDER = LEARN_LESSONS.filter(
  (lesson) => lesson.status === 'live' && !lesson.optional,
).sort((a, b) => {
  const trackDiff = TRACK_ORDER.indexOf(a.trackId) - TRACK_ORDER.indexOf(b.trackId);
  if (trackDiff !== 0) {
    return trackDiff;
  }
  return a.order - b.order;
});

export function getTrack(trackId: LearnTrackId): LearnTrack | undefined {
  return LEARN_TRACKS.find((track) => track.id === trackId);
}

export function getLesson(id: string): LearnLessonMeta | undefined {
  return LEARN_LESSONS.find((lesson) => lesson.id === id);
}

export function getLessonsForTrack(trackId: LearnTrackId): LearnLessonMeta[] {
  return LEARN_LESSONS.filter((lesson) => lesson.trackId === trackId).sort((a, b) => a.order - b.order);
}

export function getHubLessonsForTrack(trackId: LearnTrackId): LearnLessonMeta[] {
  return getLessonsForTrack(trackId).filter((lesson) => !lesson.optional);
}

export function getOptionalLabForLesson(lessonId: string): LearnLessonMeta | undefined {
  return LEARN_LESSONS.find((lesson) => lesson.optional && lesson.parentLessonId === lessonId);
}

export function getLiveLessons(): LearnLessonMeta[] {
  return [...LIVE_LESSON_ORDER];
}

export function getKnownLessonIds(): Set<string> {
  return new Set(LEARN_LESSONS.map((lesson) => lesson.id));
}

export function prerequisitesMet(lesson: LearnLessonMeta, completedIds: Set<string>): boolean {
  return lesson.prerequisites.every((id) => completedIds.has(id));
}

export function isLessonLocked(
  lesson: LearnLessonMeta,
  completedIds: Set<string>,
  options?: { ignorePrerequisites?: boolean },
): boolean {
  if (options?.ignorePrerequisites || lesson.kind !== 'read') {
    return false;
  }
  return !prerequisitesMet(lesson, completedIds);
}

export function getNextLesson(completedIds: Set<string>): LearnLessonMeta | null {
  for (const lesson of LIVE_LESSON_ORDER) {
    if (!completedIds.has(lesson.id)) {
      return lesson;
    }
  }
  return null;
}

export function getAdjacentLessons(lessonId: string): {
  previous: LearnLessonMeta | null;
  next: LearnLessonMeta | null;
} {
  const index = LIVE_LESSON_ORDER.findIndex((lesson) => lesson.id === lessonId);
  if (index === -1) {
    return { previous: null, next: null };
  }
  return {
    previous: index > 0 ? LIVE_LESSON_ORDER[index - 1]! : null,
    next: index < LIVE_LESSON_ORDER.length - 1 ? LIVE_LESSON_ORDER[index + 1]! : null,
  };
}

export interface CurriculumValidationIssue {
  lessonId: string;
  message: string;
}

export function validateCurriculum(contentLessonIds: Set<string>): CurriculumValidationIssue[] {
  const issues: CurriculumValidationIssue[] = [];
  const ids = new Set<string>();

  for (const lesson of LEARN_LESSONS) {
    if (ids.has(lesson.id)) {
      issues.push({ lessonId: lesson.id, message: 'Duplicate lesson id' });
    }
    ids.add(lesson.id);

    for (const prerequisite of lesson.prerequisites) {
      if (!getLesson(prerequisite)) {
        issues.push({
          lessonId: lesson.id,
          message: `Unknown prerequisite: ${prerequisite}`,
        });
      }
    }

    if (lesson.status === 'live' && lesson.kind === 'read' && !lesson.contentFile) {
      issues.push({ lessonId: lesson.id, message: 'Live read lesson missing contentFile' });
    }

    if (lesson.contentFile && !contentLessonIds.has(lesson.id)) {
      issues.push({
        lessonId: lesson.id,
        message: `Missing content loader for ${lesson.contentFile}`,
      });
    }

    if (lesson.status === 'live' && !lesson.route) {
      issues.push({ lessonId: lesson.id, message: 'Live lesson missing route' });
    }
  }

  for (const trackId of TRACK_ORDER) {
    const trackLessons = getHubLessonsForTrack(trackId);
    const orders = trackLessons.map((lesson) => lesson.order);
    const expected = trackLessons.map((_, index) => index + 1);
    if (orders.join(',') !== expected.join(',')) {
      issues.push({
        lessonId: trackId,
        message: `Track ${trackId} has non-contiguous order values`,
      });
    }
  }

  return issues;
}
