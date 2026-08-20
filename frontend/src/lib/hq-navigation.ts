export type HqDetailLinkParams = {
  from?: string;
  year?: number;
  month?: number;
};

/** Build HQ drill-down URLs that survive opening in a new browser tab. */
export function buildHqDetailHref(
  path: string,
  params: HqDetailLinkParams = {},
): string {
  const search = new URLSearchParams();
  if (params.from?.trim()) search.set("from", params.from.trim());
  if (params.year != null && Number.isFinite(params.year)) {
    search.set("year", String(params.year));
  }
  if (params.month != null && Number.isFinite(params.month)) {
    search.set("month", String(params.month));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export function readHqDetailSearchParams(search: string): HqDetailLinkParams {
  const params = new URLSearchParams(search);
  const yearRaw = params.get("year");
  const monthRaw = params.get("month");
  const year = yearRaw ? Number.parseInt(yearRaw, 10) : undefined;
  const month = monthRaw ? Number.parseInt(monthRaw, 10) : undefined;
  return {
    from: params.get("from") ?? undefined,
    year: Number.isFinite(year) ? year : undefined,
    month: Number.isFinite(month) ? month : undefined,
  };
}
