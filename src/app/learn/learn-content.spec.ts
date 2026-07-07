import { describe, expect, it } from 'vitest';

import { validateAllLessonContent } from './learn-content';

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
});
