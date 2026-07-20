import { describe, expect, it } from 'vitest';

import {
  getTutorExcerpts,
  getTutorPageGrounding,
  resolveContentLessonId,
} from './learn-tutor-grounding';

describe('learn-tutor-grounding', () => {
  it('maps bias lab to parent content and neuron bias sense', () => {
    expect(resolveContentLessonId('bias-and-weights-lab')).toBe('bias-and-weights');

    const grounding = getTutorPageGrounding('bias-and-weights-lab');
    expect(grounding.lessonTitle).toBe('Bias and weights lab');
    expect(grounding.lessonSummary).toContain('bias');
    expect(grounding.termHints.map((hint) => hint.term)).toEqual(['bias', 'weights']);
    expect(grounding.termHints[0]?.sense).toMatch(/offset|baseline/i);
    expect(grounding.termHints[0]?.sense).not.toMatch(/fairness/i);
  });

  it('hints temperature senses for controlling generation', () => {
    const grounding = getTutorPageGrounding('controlling-generation');
    expect(grounding.termHints.map((hint) => hint.term)).toEqual([
      'temperature',
      'topP',
      'maxTokens',
    ]);
    expect(grounding.termHints[0]?.sense).toMatch(/sampling|random|token/i);
  });

  it('hints semantic memory senses (not chat history)', () => {
    const grounding = getTutorPageGrounding('semantic-memory');
    expect(grounding.termHints.map((hint) => hint.term)).toEqual([
      'semanticMemory',
      'retrieval',
      'embedding',
    ]);
    expect(grounding.termHints[0]?.sense).toMatch(/outside|knowledge|search/i);
  });

  it('returns empty grounding on the hub', () => {
    expect(getTutorPageGrounding(null)).toEqual({
      lessonId: null,
      contentLessonId: null,
      lessonTitle: null,
      lessonSummary: null,
      route: null,
      termHints: [],
    });
  });

  it('ranks bias excerpts for a bias question', () => {
    const { excerpts, sources } = getTutorExcerpts(
      'bias-and-weights',
      'what does bias control',
    );
    expect(sources[0]?.route).toBe('/learn/lessons/bias-and-weights');
    expect(excerpts.length).toBeGreaterThan(0);
    expect(excerpts.some((excerpt) => /bias/i.test(excerpt.text))).toBe(true);
  });

  it('uses parent content for labs without contentFile', () => {
    const { excerpts, sources } = getTutorExcerpts(
      'bias-and-weights-lab',
      'weights and bias',
    );
    expect(sources[0]?.route).toBe('/learn/lessons/bias-and-weights');
    expect(excerpts.length).toBeGreaterThan(0);
  });
});
