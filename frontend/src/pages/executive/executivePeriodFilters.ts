import type { QueryFilters } from "@/services/types";
import { ALL_SETTLEMENTS } from "@/hooks/useLocationCatalog";
import { EXECUTIVE_YEARS } from "./executiveAnalysisTypes";

export const ALL_YEARS = "All Years";

export const DEFAULT_EXECUTIVE_YEAR = "2026";

export const EXECUTIVE_YEAR_SELECT_OPTIONS = [
  ALL_YEARS,
  ...EXECUTIVE_YEARS.map(String),
] as const;

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
  if (
    EXECUTIVE_YEARS.includes(
      Number(trimmed) as (typeof EXECUTIVE_YEARS)[number],
    )
  ) {
    return trimmed;
  }
  return DEFAULT_EXECUTIVE_YEAR;
}

export function executiveYearExportSlug(year: string): string {
  return year === ALL_YEARS ? "all-years" : year;
}

export function buildExecutiveScopeApiFilters(input: {
  tehsil: string;
  village: string;
  year: string;
  month?: string;
  settlement?: string;
  includePeriod?: boolean;
}): QueryFilters {
  const base: QueryFilters = {
    tehsil: input.tehsil,
    village: input.village,
  };

  if (input.includePeriod !== false) {
    if (input.year !== ALL_YEARS) {
      base.year = Number(input.year);
    }
    if (input.month && input.month !== "All Months") {
      base.month = Number(input.month);
    }
  }

  if (input.settlement && input.settlement !== ALL_SETTLEMENTS) {
    base.settlement = input.settlement;
  }

  return base;
}
