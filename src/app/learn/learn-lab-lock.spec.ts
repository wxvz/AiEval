import { describe, expect, it } from 'vitest';

import { getLesson } from './curriculum';
import {
  firstMissingPrerequisiteLesson,
  isLearnLabLocked,
  resolveLearnSafeLink,
} from './learn-lab-lock';

describe('learn-lab-lock', () => {
  it('locks neural network lab until softmax is complete', () => {
    const lesson = getLesson('neural-network-lab');
    const completed = new Set<string>();

    expect(isLearnLabLocked(lesson, completed, false)).toBe(true);
    completed.add('softmax-and-distributions');
    expect(isLearnLabLocked(lesson, completed, false)).toBe(false);
  });

  it('returns first missing prerequisite lesson', () => {
    const lesson = getLesson('neural-network-lab');
    const missing = firstMissingPrerequisiteLesson(lesson, new Set());
    expect(missing?.id).toBe('softmax-and-distributions');
  });

  it('redirects locked lab routes to the first missing prerequisite', () => {
    const safe = resolveLearnSafeLink('/learn/labs/rag-playground', new Set(), false);
    expect(safe.locked).toBe(true);
    expect(safe.route).not.toBe('/learn/labs/rag-playground');
    expect(safe.title).toMatch(/Complete .+ first/);
  });

  it('keeps unlocked lab routes unchanged', () => {
    const lesson = getLesson('rag-playground-lab');
    const completed = new Set(lesson?.prerequisites ?? []);
    const safe = resolveLearnSafeLink('/learn/labs/rag-playground', completed, false);
    expect(safe).toEqual({
      route: '/learn/labs/rag-playground',
      locked: false,
      title: null,
    });
  });
});
