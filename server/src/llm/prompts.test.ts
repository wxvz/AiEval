import { describe, expect, it } from 'vitest';

import {
  buildScorePrompt,
  buildScorePromptContext,
  parseImprovedAnswer,
} from './prompts.js';
import type { Answer, RubricCriterion } from '../types/evaluation.js';

const criteria: RubricCriterion[] = [
  { id: 'c1', name: 'Accuracy', maxPoints: 5 },
  { id: 'c2', name: 'Clarity', maxPoints: 5 },
];

const answer: Answer = {
  id: 'a1',
  evaluationId: 'eval-1',
  label: 'Model A',
  content: 'Answer text',
  scores: [],
};

describe('buildScorePromptContext', () => {
  it('builds shared header once for multiple answers', () => {
    const context = buildScorePromptContext('User prompt', criteria);
    const first = buildScorePrompt(context, answer);
    const second = buildScorePrompt(context, { ...answer, id: 'a2', label: 'Model B' });

    expect(first).toContain('User prompt:\nUser prompt');
    expect(second).toContain('Model B');
    expect(first.split('Model answer')[0]).toBe(second.split('Model answer')[0]);
  });
});

describe('parseImprovedAnswer', () => {
  it('converts nested JSON fields to readable sentences', () => {
    const improved = parseImprovedAnswer({
      strengths: { clarity: 'clear structure', depth: 'good detail' },
      finalAnswer: 'Final text',
    });

    expect(improved.strengths).toContain('clarity: clear structure.');
    expect(improved.finalAnswer).toBe('Final text');
  });
});
