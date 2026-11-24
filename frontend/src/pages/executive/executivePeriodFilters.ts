import type { QueryFilters } from "@/services/types";
import { ALL_SETTLEMENTS } from "@/hooks/useLocationCatalog";
import { EXECUTIVE_MONTHS, EXECUTIVE_YEARS } from "./executiveAnalysisTypes";
import { getPakistanYear } from "@/utils/pakistanTime";

export const ALL_YEARS = "All Years";
export const ALL_MONTHS = "All Months";

/** Current year (Pakistan) — always present in data-driven year lists. */
export const DEFAULT_EXECUTIVE_YEAR = String(getPakistanYear());

/** URL / API query keys for a custom inclusive date range (YYYY-MM-DD). */
export const DATE_FROM_PARAM = "date_from";
export const DATE_TO_PARAM = "date_to";

export const EXECUTIVE_YEAR_SELECT_OPTIONS = [
  ALL_YEARS,
  ...EXECUTIVE_YEARS.map(String),
] as const;

/**
 * Reporting period shared by every HQ screen. When `dateFrom` and `dateTo`
 * are both set the custom range wins; otherwise `year` / `month` apply.
 */
export type ExecutivePeriod = {
  year: string;
  month: string;
  dateFrom: string;
  dateTo: string;
};

export function executiveYearLabel(year: string): string {
  return year === ALL_YEARS ? "All years" : year;
}

export function resolveExecutiveYearFromUrl(
  urlYear: string | undefined | null,
): string {
  const trimmed = urlYear?.trim() ?? "";
  if (!trimmed) return DEFAULT_EXECUTIVE_YEAR;
  if (trimmed === ALL_YEARS || trimmed.toLowerCase() === "all years") {
    return ALL_YEARS;
  }
  // Year lists are data-driven, so accept any plausible calendar year.
  const n = Number(trimmed);
  if (Number.isInteger(n) && n >= 2000 && n <= 2100) {
    return String(n);
  }
  return DEFAULT_EXECUTIVE_YEAR;
}

export function executiveYearExportSlug(year: string): string {
  return year === ALL_YEARS ? "all-years" : year;
}

/* ── Custom date range ─────────────────────────────────────────────────── */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Strict YYYY-MM-DD that is a real calendar date. */
export function isIsoDate(value: string | null | undefined): value is string {
  const m = ISO_DATE.exec(String(value ?? ""));
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
}

export function hasDateRange(
  p: Pick<ExecutivePeriod, "dateFrom" | "dateTo"> | null | undefined,
): boolean {
  return Boolean(
    p && isIsoDate(p.dateFrom) && isIsoDate(p.dateTo) && p.dateFrom <= p.dateTo,
  );
}

/** Read a valid range from the URL; anything invalid yields an empty range. */
export function resolveDateRangeFromUrl(
  searchParams: URLSearchParams,
): Pick<ExecutivePeriod, "dateFrom" | "dateTo"> {
  const dateFrom = searchParams.get(DATE_FROM_PARAM)?.trim() ?? "";
  const dateTo = searchParams.get(DATE_TO_PARAM)?.trim() ?? "";
  return hasDateRange({ dateFrom, dateTo })
    ? { dateFrom, dateTo }
    : { dateFrom: "", dateTo: "" };
}

/** [year, month, day] numbers from a YYYY-MM-DD string. */
export function isoParts(iso: string): [number, number, number] {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return [y, m, d];
}

/** Local Date at midnight for a YYYY-MM-DD string (calendar-safe). */
export function isoToLocalDate(iso: string): Date {
  const [y, m, d] = isoParts(iso);
  return new Date(y, m - 1, d);
}

/** YYYY-MM-DD from a local Date (no UTC shift). */
export function localDateToIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** "1 Jan 2026" */
export function formatIsoDateShort(iso: string): string {
  const [y, m, d] = isoParts(iso);
  return `${d} ${EXECUTIVE_MONTHS[m - 1] ?? ""} ${y}`;
}

/** "1 Jan 2026 – 31 Oct 2026" (collapses a single day). */
export function formatDateRangeLabel(dateFrom: string, dateTo: string): string {
  if (dateFrom === dateTo) return formatIsoDateShort(dateFrom);
  return `${formatIsoDateShort(dateFrom)} – ${formatIsoDateShort(dateTo)}`;
}

/** Human label for the active period: range, "Oct 2026", "2026" or "All years". */
export function executivePeriodLabel(p: ExecutivePeriod): string {
  if (hasDateRange(p)) return formatDateRangeLabel(p.dateFrom, p.dateTo);
  const yearLabel = executiveYearLabel(p.year);
  if (p.month && p.month !== ALL_MONTHS) {
    return `${EXECUTIVE_MONTHS[Number(p.month) - 1] ?? "Month"} ${yearLabel}`;
  }
  return yearLabel;
}

export function executivePeriodExportSlug(p: ExecutivePeriod): string {
  if (hasDateRange(p)) return `${p.dateFrom}_to_${p.dateTo}`;
  const year = executiveYearExportSlug(p.year);
  return p.month && p.month !== ALL_MONTHS
    ? `${year}-${String(p.month).padStart(2, "0")}`
    : year;
}

export type PeriodMonthBucket = {
  year: number;
  month: number;
  key: string;
  /** "Jan" within one year, "Jan '26" when the range spans years. */
  label: string;
};

/** Every calendar month the range touches (oldest first); null when no range. */
export function periodMonthBuckets(
  p: Pick<ExecutivePeriod, "dateFrom" | "dateTo">,
): PeriodMonthBucket[] | null {
  if (!hasDateRange(p)) return null;
  const [fy, fm] = isoParts(p.dateFrom);
  const [ty, tm] = isoParts(p.dateTo);
  const multiYear = fy !== ty;
  const out: PeriodMonthBucket[] = [];
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    const short = EXECUTIVE_MONTHS[m - 1] ?? String(m);
    out.push({
      year: y,
      month: m,
      key: `${y}-${m}`,
      label: multiYear ? `${short} '${String(y).slice(-2)}` : short,
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** Write the period into URL params (range replaces year/month and vice versa). */
export function writePeriodToSearchParams(
  params: URLSearchParams,
  p: ExecutivePeriod,
): URLSearchParams {
  if (hasDateRange(p)) {
    params.set(DATE_FROM_PARAM, p.dateFrom);
    params.set(DATE_TO_PARAM, p.dateTo);
    params.delete("year");
    params.delete("month");
  } else {
    params.delete(DATE_FROM_PARAM);
    params.delete(DATE_TO_PARAM);
    if (p.year && p.year !== ALL_YEARS) params.set("year", p.year);
    else params.delete("year");
    if (p.month && p.month !== ALL_MONTHS) params.set("month", p.month);
    else params.delete("month");
  }
  return params;
}

/* ── API filters ───────────────────────────────────────────────────────── */

export type ExecutivePeriodFilterMode = "full" | "year-only" | "none";

export function buildExecutiveScopeApiFilters(input: {
  tehsil: string;
  village: string;
  year: string;
  month?: string;
  dateFrom?: string;
  dateTo?: string;
  settlement?: string;
  /** @deprecated use periodFilterMode */
  includePeriod?: boolean;
  periodFilterMode?: ExecutivePeriodFilterMode;
}): QueryFilters {
  const base: QueryFilters = {
    tehsil: input.tehsil,
    village: input.village,
  };

  const periodFilterMode =
    input.periodFilterMode ??
    (input.includePeriod === false ? "none" : "full");

  const range = {
    dateFrom: input.dateFrom ?? "",
    dateTo: input.dateTo ?? "",
  };

  if (periodFilterMode !== "none" && hasDateRange(range)) {
    base[DATE_FROM_PARAM] = range.dateFrom;
    base[DATE_TO_PARAM] = range.dateTo;
  } else {
    if (periodFilterMode === "full" || periodFilterMode === "year-only") {
      if (input.year !== ALL_YEARS) {
        base.year = Number(input.year);
      }
    }

    if (periodFilterMode === "full") {
      if (input.month && input.month !== ALL_MONTHS) {
        base.month = Number(input.month);
      }
    }
  }

  if (input.settlement && input.settlement !== ALL_SETTLEMENTS) {
    base.settlement = input.settlement;
  }

  return base;
}

/** Append the period as query params (detail pages open in a new tab, so router state is lost). */
export function withPeriodQuery(path: string, p: ExecutivePeriod): string {
  const [base = path, qs = ""] = path.split("?");
  const params = writePeriodToSearchParams(new URLSearchParams(qs), p);
  const out = params.toString();
  return out ? `${base}?${out}` : base;
}

/** Parse the period from a detail page URL (range, else year/month). */
export function resolvePeriodFromUrl(
  searchParams: URLSearchParams,
  fallbackYear: string = DEFAULT_EXECUTIVE_YEAR,
): ExecutivePeriod {
  const range = resolveDateRangeFromUrl(searchParams);
  const rawYear = searchParams.get("year")?.trim() ?? "";
  const rawMonth = searchParams.get("month")?.trim() ?? "";
  const monthNum = Number(rawMonth);
  return {
    year: rawYear ? resolveExecutiveYearFromUrl(rawYear) : fallbackYear,
    month:
      Number.isInteger(monthNum) && monthNum >= 1 && monthNum <= 12
        ? String(monthNum)
        : ALL_MONTHS,
    ...range,
  };
}
