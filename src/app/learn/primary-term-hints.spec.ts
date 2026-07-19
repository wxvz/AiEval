import { describe, expect, it } from 'vitest';

import { loadLessonContent } from './learn-content';
import { getPrimaryTermHintIds } from './primary-term-hints';

describe('getPrimaryTermHintIds', () => {
  it('marks the first in-lesson mention of each term', () => {
    const content = loadLessonContent('learning-from-examples');
    expect(content).toBeTruthy();

    const primary = getPrimaryTermHintIds(content!);
    expect(primary.get('supervisedLearning')).toBe('s0-p1-supervisedLearning-1');
    expect(primary.get('model')).toBe('s0-p1-model-3');
    expect(primary.get('input')).toBe('s0-p2-input-1');
  });

  it('includes recap and check prompts after section body', () => {
    const content = loadLessonContent('learning-from-examples');
    expect(content).toBeTruthy();

    const primary = getPrimaryTermHintIds(content!);
    expect(primary.get('classifier')).toBe('s0-check-classifier-1');
    expect(primary.get('dataset')).toBe('s2-p4-dataset-1');
  });
});
