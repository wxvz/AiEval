import { describe, expect, it } from 'vitest';

import {
  CATALOG,
  CHALLENGE_QUERY_ID,
  CHALLENGE_TARGET_ID,
  filterCatalog,
  getQueryPreset,
  isChallengeSolved,
  rankCatalog,
} from './multimodal-vector';

describe('multimodal-vector', () => {
  it('filters by tenant and waterproof flag', () => {
    const filtered = filterCatalog(CATALOG, { tenant: 'shop-a', waterproofOnly: true });
    expect(filtered.map((item) => item.id).sort()).toEqual([
      'blue-rain-jacket',
      'scarlet-waterproof-boot',
    ]);
  });

  it('ranks image queries against image vectors', () => {
    const query = getQueryPreset(CHALLENGE_QUERY_ID)!;
    const rankings = rankCatalog(query, { tenant: 'all', waterproofOnly: false });
    expect(rankings.length).toBeGreaterThan(0);
    expect(rankings[0]!.item.id).not.toBe('blue-rain-jacket');
    expect(
      rankings.every((row, index, list) => index === 0 || list[index - 1]!.score >= row.score),
    ).toBe(true);
  });

  it('solves the challenge only with authorized waterproof filters', () => {
    const query = getQueryPreset(CHALLENGE_QUERY_ID)!;
    const unfiltered = rankCatalog(query, { tenant: 'all', waterproofOnly: false });
    expect(
      isChallengeSolved(unfiltered, CHALLENGE_QUERY_ID, { tenant: 'all', waterproofOnly: false }),
    ).toBe(false);

    const filters = { tenant: 'shop-a' as const, waterproofOnly: true };
    const filtered = rankCatalog(query, filters);
    expect(filtered[0]!.item.id).toBe(CHALLENGE_TARGET_ID);
    expect(isChallengeSolved(filtered, CHALLENGE_QUERY_ID, filters)).toBe(true);
  });

  it('keeps private tenant boots out of shop-a results', () => {
    const query = getQueryPreset(CHALLENGE_QUERY_ID)!;
    const rankings = rankCatalog(query, { tenant: 'shop-a', waterproofOnly: true });
    expect(rankings.some((row) => row.item.tenant === 'shop-b')).toBe(false);
  });
});
