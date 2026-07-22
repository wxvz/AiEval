import { describe, expect, it } from 'vitest';

import { TEACHING_CORPUS } from './corpus';
import { cosineSimilarity, rankByQuery, topK } from './similarity';
import { queryToVector } from './vocabulary';

describe('similarity', () => {
  it('cosineSimilarity is symmetric and 1 for identical vectors', () => {
    const vector = [0.6, 0.8];
    expect(cosineSimilarity(vector, vector)).toBeCloseTo(1, 5);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it('ranks evaluation rubric queries toward rubric chunks', () => {
    const results = rankByQuery('evaluation rubric criteria', 3);
    expect(results.map((row) => row.chunk.id)).toEqual([
      'rubric-basics',
      'automation-judge',
      'compare-models',
    ]);
  });

  it('ranks neural network queries toward foundation chunks', () => {
    const results = rankByQuery('neural network training', 3);
    expect(results.map((row) => row.chunk.id)).toEqual([
      'neural-network',
      'train-test-split',
      'prompt-instructions',
    ]);
  });

  it('topK returns stable ordering for ties by chunk id', () => {
    const queryVector = queryToVector('rag retrieval context');
    const results = topK(queryVector, TEACHING_CORPUS, 5);
    expect(results.length).toBe(5);
    for (let i = 1; i < results.length; i += 1) {
      expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
    }
  });
});
