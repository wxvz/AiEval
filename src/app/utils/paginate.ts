export const EVALUATIONS_PER_DAY_PAGE = 6;

export function pageCount(itemCount: number, pageSize = EVALUATIONS_PER_DAY_PAGE): number {
  return Math.max(1, Math.ceil(itemCount / pageSize));
}

export function clampPageIndex(
  pageIndex: number,
  itemCount: number,
  pageSize = EVALUATIONS_PER_DAY_PAGE,
): number {
  const maxPage = Math.max(0, Math.ceil(itemCount / pageSize) - 1);
  return Math.min(Math.max(0, pageIndex), maxPage);
}

export function paginateSlice<T>(
  items: T[],
  pageIndex: number,
  pageSize = EVALUATIONS_PER_DAY_PAGE,
): T[] {
  const start = pageIndex * pageSize;
  return items.slice(start, start + pageSize);
}
