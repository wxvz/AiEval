import { describe, expect, it } from 'vitest';

import {
  lessonHasBody,
  loadLessonContent,
  validateAllLessonContent,
  validateLessonContent,
  type LessonContent,
} from './learn-content';

describe('lessonHasBody', () => {
  it('returns false for lessons without loaded content', () => {
    expect(lessonHasBody('lesson-without-body')).toBe(false);
  });

  it('returns true for lessons with sections', () => {
    expect(lessonHasBody('prompts-as-instructions')).toBe(true);
  });
});

describe('validateLessonContent', () => {
  it('passes for stub lessons with empty sections', () => {
    const issues = validateAllLessonContent().filter((issue) =>
      ['prompts-as-instructions', 'comparing-answers'].includes(issue.lessonId),
    );
    expect(issues).toEqual([]);
  });

  it('validates full lessons after content migration', () => {
    const issues = validateAllLessonContent().filter(
      (issue) =>
        issue.lessonId === 'learning-from-examples' ||
        issue.lessonId === 'train-vs-test' ||
        issue.lessonId === 'loss-and-updates' ||
        issue.lessonId === 'semantic-memory',
    );
    expect(issues).toEqual([]);
  });

  it('flags empty aside title or body', () => {
    const content = loadLessonContent('prompts-as-instructions') as LessonContent;
    const broken: LessonContent = {
      ...content,
      sections: content.sections.map((section, index) =>
        index === 0 ? { ...section, aside: { title: '', body: 'Tip body' } } : section,
      ),
    };
    const issues = validateLessonContent('prompts-as-instructions', broken);
    expect(issues.some((issue) => issue.message.includes('aside title is empty'))).toBe(true);
  });
});
