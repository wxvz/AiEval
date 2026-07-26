import { describe, expect, it } from 'vitest';

import { pathFromLearnRoute, queryParamsFromLearnRoute } from './learn-route';

describe('learn-route', () => {
  it('splits path and query params for aside CTAs', () => {
    const route = '/evaluations/new?from=learn&learnLesson=first-evaluation-lab';
    expect(pathFromLearnRoute(route)).toBe('/evaluations/new');
    expect(queryParamsFromLearnRoute(route)).toEqual({
      from: 'learn',
      learnLesson: 'first-evaluation-lab',
    });
  });

  it('returns empty query params when none are present', () => {
    expect(pathFromLearnRoute('/learn/labs/softmax')).toBe('/learn/labs/softmax');
    expect(queryParamsFromLearnRoute('/learn/labs/softmax')).toEqual({});
  });

  it('strips hash from path and query values', () => {
    expect(pathFromLearnRoute('/evaluations/new#section')).toBe('/evaluations/new');
    expect(queryParamsFromLearnRoute('/evaluations/new?from=learn#frag')).toEqual({
      from: 'learn',
    });
  });

  it('tolerates malformed percent-encoding without throwing', () => {
    expect(() => queryParamsFromLearnRoute('/evaluations/new?from=%E0%A4%A')).not.toThrow();
    expect(queryParamsFromLearnRoute('/evaluations/new?from=%E0%A4%A')).toEqual({
      from: '%E0%A4%A',
    });
  });
});
