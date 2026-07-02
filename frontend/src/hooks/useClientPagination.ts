import { useCallback, useMemo, useState } from "react";

export function useClientPagination<T>(
  items: T[],
  initialPageSize = 10,
) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize) || 1);

  const safePageIndex = Math.min(pageIndex, pageCount - 1);

  const pageItems = useMemo(() => {
    const start = safePageIndex * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePageIndex, pageSize]);

  const setPageSizeAndReset = (size: number) => {
    setPageSize(size);
    setPageIndex(0);
  };

  const goToPage = useCallback(
    (index: number) => {
      setPageIndex(Math.max(0, Math.min(index, pageCount - 1)));
    },
    [pageCount],
  );

  const resetPage = useCallback(() => setPageIndex(0), []);

  return {
    pageItems,
    pageIndex: safePageIndex,
    pageSize,
    pageCount,
    total: items.length,
    setPageSize: setPageSizeAndReset,
    goToPage,
    nextPage: () => goToPage(safePageIndex + 1),
    prevPage: () => goToPage(safePageIndex - 1),
    resetPage,
  };
}
