import {
  getLesson,
  getLessonByRoute,
  type LearnLessonMeta,
  isLessonLocked,
} from './curriculum';
import { pathFromLearnRoute } from './learn-route';

/** Shared lock check for lab pages and callout UI. */
export function isLearnLabLocked(
  lesson: LearnLessonMeta | null | undefined,
  completedIds: Set<string>,
  unlockAll: boolean,
): boolean {
  if (!lesson) {
    return false;
  }
  return isLessonLocked(lesson, completedIds, { ignorePrerequisites: unlockAll });
}

/** First incomplete prerequisite lesson for lock messaging. */
export function firstMissingPrerequisiteLesson(
  lesson: LearnLessonMeta | null | undefined,
  completedIds: Set<string>,
  resolveLesson: (id: string) => LearnLessonMeta | undefined = getLesson,
): LearnLessonMeta | null {
  if (!lesson?.prerequisites.length) {
    return null;
  }
  const firstMissing = lesson.prerequisites.find((id) => !completedIds.has(id));
  return firstMissing ? resolveLesson(firstMissing) ?? null : null;
}

export interface LearnSafeLinkTarget {
  route: string;
  locked: boolean;
  /** When locked, human-readable unlock hint for title/tooltip. */
  title: string | null;
}

/**
 * Resolve a learn route for navigation. Locked curriculum targets redirect to the
 * first missing prerequisite (or `/learn`) so learners are not dumped on a gated page.
 */
export function resolveLearnSafeLink(
  route: string,
  completedIds: Set<string>,
  unlockAll: boolean,
): LearnSafeLinkTarget {
  const pathname = pathFromLearnRoute(route);
  const lesson = getLessonByRoute(pathname);
  if (!lesson || !isLearnLabLocked(lesson, completedIds, unlockAll)) {
    return { route: pathname, locked: false, title: null };
  }
  const prereq = firstMissingPrerequisiteLesson(lesson, completedIds);
  if (prereq) {
    return {
      route: prereq.route,
      locked: true,
      title: `Complete ${prereq.title} first`,
    };
  }
  return {
    route: '/learn',
    locked: true,
    title: 'Complete earlier lessons first',
  };
}
