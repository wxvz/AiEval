import { describe, expect, it } from 'vitest';

import {
  getLiveLessons,
  getNextLesson,
  getLesson,
  getHubLessonsForTrack,
  getOptionalLabForLesson,
  isLessonLocked,
  validateCurriculum,
} from './curriculum';
import { getContentLessonIds } from './learn-content';

describe('curriculum', () => {
  it('passes validateCurriculum', () => {
    const issues = validateCurriculum(getContentLessonIds());
    expect(issues).toEqual([]);
  });

  it('orders live lessons foundation reads before neural-network-lab', () => {
    const live = getLiveLessons();
    const nnIndex = live.findIndex((lesson) => lesson.id === 'neural-network-lab');
    const readIds = live
      .slice(0, nnIndex)
      .filter((lesson) => lesson.trackId === 'foundation' && lesson.kind === 'read')
      .map((lesson) => lesson.id);
    expect(readIds).toEqual(['learning-from-examples', 'train-vs-test', 'loss-and-updates']);
  });

  it('keeps optional labs off the hub track list', () => {
    const hubIds = getHubLessonsForTrack('foundation').map((lesson) => lesson.id);
    expect(hubIds).toEqual([
      'learning-from-examples',
      'train-vs-test',
      'loss-and-updates',
      'neural-network-lab',
    ]);
    expect(getLiveLessons().map((lesson) => lesson.id)).not.toContain('train-vs-test-lab');
    expect(getLiveLessons().map((lesson) => lesson.id)).not.toContain('loss-and-updates-lab');
  });

  it('links optional labs to parent read lessons', () => {
    expect(getOptionalLabForLesson('train-vs-test')?.route).toBe('/learn/labs/train-vs-test');
    expect(getOptionalLabForLesson('loss-and-updates')?.route).toBe('/learn/labs/loss-and-updates');
    expect(getOptionalLabForLesson('learning-from-examples')).toBeUndefined();
  });

  it('orders llm reads before semantic-search-lab', () => {
    const live = getLiveLessons();
    const labIndex = live.findIndex((lesson) => lesson.id === 'semantic-search-lab');
    const readIds = live
      .slice(0, labIndex)
      .filter((lesson) => lesson.trackId === 'llm-systems' && lesson.kind === 'read')
      .map((lesson) => lesson.id);
    expect(readIds).toEqual([
      'prompts-as-instructions',
      'comparing-answers',
      'rubrics-and-criteria',
      'semantic-memory',
    ]);
  });

  it('orders retrieval labs before first-evaluation-lab', () => {
    const live = getLiveLessons();
    const evalLabIndex = live.findIndex((lesson) => lesson.id === 'first-evaluation-lab');
    const llmSlice = live
      .slice(0, evalLabIndex)
      .filter((lesson) => lesson.trackId === 'llm-systems')
      .map((lesson) => lesson.id);
    expect(llmSlice).toEqual([
      'prompts-as-instructions',
      'comparing-answers',
      'rubrics-and-criteria',
      'semantic-memory',
      'semantic-search-lab',
      'rag-playground-lab',
    ]);
  });

  it('links new labs to routes and prerequisites', () => {
    expect(getLesson('semantic-search-lab')?.route).toBe('/learn/labs/semantic-search');
    expect(getLesson('rag-playground-lab')?.route).toBe('/learn/labs/rag-playground');
    expect(getLesson('semantic-search-lab')?.prerequisites).toEqual(['semantic-memory']);
    expect(getLesson('first-evaluation-lab')?.prerequisites).toEqual(['rag-playground-lab']);
  });

  it('getNextLesson skips completed lessons in global order', () => {
    const completed = new Set(['learning-from-examples', 'train-vs-test']);
    expect(getNextLesson(completed)?.id).toBe('loss-and-updates');
  });

  it('getNextLesson returns null when all live lessons complete', () => {
    const completed = new Set(getLiveLessons().map((lesson) => lesson.id));
    expect(getNextLesson(completed)).toBeNull();
  });

  it('links optional foundation labs to routes', () => {
    expect(getLesson('train-vs-test-lab')?.route).toBe('/learn/labs/train-vs-test');
    expect(getLesson('train-vs-test-lab')?.optional).toBe(true);
    expect(getLesson('loss-and-updates-lab')?.route).toBe('/learn/labs/loss-and-updates');
    expect(getLesson('loss-and-updates-lab')?.parentLessonId).toBe('loss-and-updates');
  });

  it('links neural-network-lab to labs route', () => {
    expect(getLesson('neural-network-lab')?.route).toBe('/learn/labs/neural-network');
  });

  it('orders go-deeper lessons after automation-and-judges', () => {
    const live = getLiveLessons();
    const automationIndex = live.findIndex((lesson) => lesson.id === 'automation-and-judges');
    const goDeeperIds = live
      .slice(automationIndex + 1)
      .filter((lesson) => lesson.trackId === 'go-deeper')
      .map((lesson) => lesson.id);
    expect(goDeeperIds).toEqual([
      'transformers-overview',
      'production-concerns',
      'building-eval-harnesses',
    ]);
  });

  it('chains go-deeper prerequisites from automation-and-judges', () => {
    expect(getLesson('transformers-overview')?.prerequisites).toEqual(['automation-and-judges']);
    expect(getLesson('production-concerns')?.prerequisites).toEqual(['transformers-overview']);
    expect(getLesson('building-eval-harnesses')?.prerequisites).toEqual(['production-concerns']);
  });

  it('locks read lessons until prerequisites are complete', () => {
    const lesson = getLesson('comparing-answers');
    expect(lesson).toBeTruthy();
    expect(isLessonLocked(lesson!, new Set())).toBe(true);
    expect(isLessonLocked(lesson!, new Set(['prompts-as-instructions']))).toBe(false);
  });

  it('ignores prerequisites when unlock option is set', () => {
    const lesson = getLesson('comparing-answers');
    expect(isLessonLocked(lesson!, new Set(), { ignorePrerequisites: true })).toBe(false);
  });
});
