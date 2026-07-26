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
        issue.lessonId === 'what-is-a-dataset' ||
        issue.lessonId === 'train-vs-test' ||
        issue.lessonId === 'loss-and-updates' ||
        issue.lessonId === 'data-literacy' ||
        issue.lessonId === 'decision-trees' ||
        issue.lessonId === 'deep-learning-approaches' ||
        issue.lessonId === 'semantic-memory' ||
        issue.lessonId === 'mcp' ||
        issue.lessonId === 'multimodal-vector-databases',
    );
    expect(issues).toEqual([]);
  });

  it('loads complete MCP and multimodal vector database lessons', () => {
    for (const lessonId of ['mcp', 'multimodal-vector-databases']) {
      const content = loadLessonContent(lessonId);
      expect(content?.sections).toHaveLength(3);
      expect(content?.recapQuestions).toHaveLength(2);
      expect(content?.sections.every((section) => section.paragraphs.length >= 4)).toBe(true);
    }
  });

  it('loads complete decision tree and deep learning lessons', () => {
    for (const lessonId of ['decision-trees', 'deep-learning-approaches']) {
      const content = loadLessonContent(lessonId);
      expect(content?.sections).toHaveLength(3);
      expect(content?.recapQuestions).toHaveLength(2);
      expect(content?.sections.every((section) => section.paragraphs.length >= 4)).toBe(true);
    }
  });

  it('loads complete reinforcement learning and GAN lessons', () => {
    for (const lessonId of ['reinforcement-learning', 'generative-adversarial-networks']) {
      const content = loadLessonContent(lessonId);
      expect(content?.sections).toHaveLength(3);
      expect(content?.recapQuestions).toHaveLength(2);
      expect(content?.sections.every((section) => section.paragraphs.length >= 4)).toBe(true);
      expect(content?.sections.every((section) => section.check?.explanation)).toBe(true);
    }
  });

  it('requires choices or a wordBank on every check question', () => {
    const content = loadLessonContent('what-is-a-dataset') as LessonContent;
    const broken: LessonContent = {
      ...content,
      sections: content.sections.map((section, index) =>
        index === 2 && section.check
          ? { ...section, check: { ...section.check, wordBank: undefined, choices: undefined } }
          : section,
      ),
    };
    const issues = validateLessonContent('what-is-a-dataset', broken);
    expect(issues.some((issue) => issue.message.includes('needs choices or a wordBank'))).toBe(true);
  });

  it('flags wordBank that cannot assemble the answer', () => {
    const content = loadLessonContent('what-is-a-dataset') as LessonContent;
    const broken: LessonContent = {
      ...content,
      sections: content.sections.map((section, index) =>
        index === 2 && section.check
          ? { ...section, check: { ...section.check, wordBank: ['unrelated', 'words'] } }
          : section,
      ),
    };
    const issues = validateLessonContent('what-is-a-dataset', broken);
    expect(issues.some((issue) => issue.message.includes('missing answer words'))).toBe(true);
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

  it('allows tip asides with from=learn and no learnLesson', () => {
    const content = loadLessonContent('prompts-as-instructions') as LessonContent;
    const withTip: LessonContent = {
      ...content,
      sections: content.sections.map((section, index) =>
        index === 0
          ? {
              ...section,
              aside: {
                title: 'Try in AiEval',
                body: 'Create an evaluation.',
                route: '/evaluations/new?from=learn',
              },
            }
          : section,
      ),
    };
    const issues = validateLessonContent('prompts-as-instructions', withTip);
    expect(issues.some((issue) => issue.message.includes('aside'))).toBe(false);
  });

  it('flags aside learnLesson that is not a tool lesson', () => {
    const content = loadLessonContent('prompts-as-instructions') as LessonContent;
    const broken: LessonContent = {
      ...content,
      sections: content.sections.map((section, index) =>
        index === 0
          ? {
              ...section,
              aside: {
                title: 'Try in AiEval',
                body: 'Create an evaluation.',
                route: '/evaluations/new?from=learn&learnLesson=what-is-a-dataset',
              },
            }
          : section,
      ),
    };
    const issues = validateLessonContent('prompts-as-instructions', broken);
    expect(
      issues.some((issue) => issue.message.includes('learnLesson must be a tool lesson id')),
    ).toBe(true);
  });
});

