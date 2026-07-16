import { useCallback, useEffect, useMemo, useState } from "react";

/** Default page sizes tuned for admin dashboards with large facility lists. */
export const PAGE_SIZE = {
  issues: 10,
  tehsils: 12,
  systems: 15,
  villages: 80,
  mapMarkers: 800,
} as const;

export function useClientPagination<T>(
  items: T[],
  pageSize: number,
  resetKey?: string | number,
) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize, total]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const goTo = useCallback(
    (next: number) => {
      setPage(Math.min(pageCount, Math.max(1, next)));
    },
    [pageCount],
  );

  const rangeLabel = useMemo(() => {
    if (total === 0) return "0 of 0";
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return `${start}–${end} of ${total}`;
  }, [page, pageSize, total]);

  return {
    page,
    pageCount,
    pageItems,
    total,
    rangeLabel,
    setPage: goTo,
    next: () => goTo(page + 1),
    prev: () => goTo(page - 1),
    canPrev: page > 1,
    canNext: page < pageCount,
  };
}
