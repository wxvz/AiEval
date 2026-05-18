import { describe, expect, it } from 'vitest';

import {
  buildImprovedPrompt,
  buildScorePrompt,
  buildScorePromptContext,
  GENERATE_SYSTEM,
  JUDGE_SCORE_SYSTEM,
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

describe('system prompts', () => {
  it('instructs answer models to avoid rubric meta', () => {
    expect(GENERATE_SYSTEM).toMatch(/plain text/i);
    expect(GENERATE_SYSTEM).toMatch(/rubric|scoring/i);
  });

  it('instructs judge to score in isolation', () => {
    expect(JUDGE_SCORE_SYSTEM).toMatch(/one model answer/i);
    expect(JUDGE_SCORE_SYSTEM).toMatch(/JSON/i);
  });
});

describe('buildScorePromptContext', () => {
  it('builds shared header once for multiple answers', () => {
    const context = buildScorePromptContext('User prompt', criteria);
    const first = buildScorePrompt(context, answer);
    const second = buildScorePrompt(context, { ...answer, id: 'a2', label: 'Model B' });

    expect(first).toContain('Original user prompt');
    expect(first).toContain('User prompt');
    expect(first).toContain('Scoring rules');
    expect(second).toContain('Model B');
    expect(first.split('Model answer to score')[0]).toBe(
      second.split('Model answer to score')[0],
    );
  });

  it('lists every criterion id in the header', () => {
    const context = buildScorePromptContext('User prompt', criteria);
    expect(context.header).toContain('c1, c2');
  });
});

describe('buildImprovedPrompt', () => {
  it('includes per-criterion scores and rubric block', () => {
    const scoredAnswer: Answer = {
      ...answer,
      scores: [
        { criterionId: 'c1', criterionName: 'Accuracy', points: 4, maxPoints: 5 },
        { criterionId: 'c2', criterionName: 'Clarity', points: 3, maxPoints: 5 },
      ],
      isWinner: true,
    };

    const prompt = buildImprovedPrompt('User prompt', criteria, [scoredAnswer], scoredAnswer);

    expect(prompt).toContain('Accuracy: 4/5');
    expect(prompt).toContain('Rubric criteria');
    expect(prompt).toContain('finalAnswer');
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
