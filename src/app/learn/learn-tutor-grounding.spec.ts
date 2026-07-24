import { describe, expect, it } from 'vitest';

import {
  filterKnownTutorSources,
  getTutorCurriculumCatalog,
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

  it('hints dataset senses on the XOR dataset lab (parent lesson)', () => {
    expect(resolveContentLessonId('what-is-a-dataset-lab')).toBe('what-is-a-dataset');

    const grounding = getTutorPageGrounding('what-is-a-dataset-lab');
    expect(grounding.lessonTitle).toBe('Build the XOR dataset');
    expect(grounding.termHints.map((hint) => hint.term)).toEqual([
      'dataset',
      'input',
      'target',
      'labeledData',
    ]);
    expect(grounding.termHints[0]?.sense).toMatch(/input.?target|collection/i);
    expect(grounding.termHints[0]?.sense).not.toMatch(/flash.?card|deck/i);
  });

  it('prefers literal dataset definition over flash-card analogy in excerpts', () => {
    const { excerpts, sources } = getTutorExcerpts(
      'what-is-a-dataset-lab',
      'What is a dataset?',
    );
    expect(sources[0]?.route).toBe('/learn/lessons/what-is-a-dataset');
    expect(excerpts.some((excerpt) => /collection of input-target pairs/i.test(excerpt.text))).toBe(
      true,
    );
    expect(excerpts.every((excerpt) => !/whole deck of flash cards/i.test(excerpt.text))).toBe(true);
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
    expect(excerpts.every((excerpt) => excerpt.text.length <= 600)).toBe(true);
  });

  it('uses parent content for labs without contentFile', () => {
    const { excerpts, sources } = getTutorExcerpts(
      'bias-and-weights-lab',
      'weights and bias',
    );
    expect(sources[0]?.route).toBe('/learn/lessons/bias-and-weights');
    expect(excerpts.length).toBeGreaterThan(0);
  });

  it('falls back to embedding re-rank when keyword overlap plateaus', () => {
    // Nonsense tokens → keyword max is only the 0.5 first-paragraph baseline.
    const { excerpts } = getTutorExcerpts('bias-and-weights', 'xyzzy plugh');
    expect(excerpts.length).toBeGreaterThan(0);
  });

  it('cross-retrieves bias lesson when asked off the RAG lab', () => {
    const { excerpts, sources, relatedTermHints } = getTutorExcerpts(
      'rag-playground-lab',
      'how does bias control work',
    );
    expect(sources[0]?.title).toBe('Bias and weights');
    expect(sources[0]?.route).toBe('/learn/lessons/bias-and-weights');
    expect(excerpts.length).toBeGreaterThan(0);
    expect(excerpts.some((excerpt) => /bias/i.test(excerpt.text))).toBe(true);
    expect(relatedTermHints.map((hint) => hint.term)).toEqual(['bias', 'weights']);
  });

  it('exposes a live curriculum catalog with Bias and weights', () => {
    const catalog = getTutorCurriculumCatalog();
    expect(catalog.some((entry) => entry.title === 'Bias and weights')).toBe(true);
    expect(catalog.some((entry) => entry.title === 'Bias control in AiEval')).toBe(false);
  });

  it('filters invented source titles against the catalog', () => {
    expect(
      filterKnownTutorSources([
        { title: 'Bias control in AiEval', route: '/learn/lessons/fake' },
        { title: 'Bias and weights', route: '/learn/lessons/bias-and-weights' },
      ]),
    ).toEqual([{ title: 'Bias and weights', route: '/learn/lessons/bias-and-weights' }]);
  });
});
