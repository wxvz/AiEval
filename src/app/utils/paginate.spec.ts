import {
  EVALUATIONS_PER_DAY_PAGE,
  clampPageIndex,
  pageCount,
  paginateSlice,
} from './paginate';

describe('paginate', () => {
  it('slices items for the requested page', () => {
    const items = Array.from({ length: 20 }, (_, index) => index);
    expect(paginateSlice(items, 0)).toEqual(items.slice(0, EVALUATIONS_PER_DAY_PAGE));
    expect(paginateSlice(items, 1)).toEqual(items.slice(6, 12));
    expect(paginateSlice(items, 2)).toEqual(items.slice(12, 18));
    expect(paginateSlice(items, 3)).toEqual(items.slice(18, 20));
  });

  it('computes page count', () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(9)).toBe(2);
    expect(pageCount(10)).toBe(2);
    expect(pageCount(18)).toBe(3);
    expect(pageCount(19)).toBe(4);
  });

  it('clamps page index to valid range', () => {
    expect(clampPageIndex(-1, 20)).toBe(0);
    expect(clampPageIndex(0, 20)).toBe(0);
    expect(clampPageIndex(2, 20)).toBe(2);
    expect(clampPageIndex(5, 20)).toBe(3);
  });
});
