import api from "@/api/api";

export type GeographyScope = {
  role: string;
  tehsils: string[];
  can_edit: boolean;
};

export type GeographyTotals = {
  tehsil_count: number;
  village_count: number;
  settlement_count: number;
  total_population: number;
  villages_with_population: number;
};

export type GeoSettlement = {
  id: string;
  name: string;
  population: number;
  population_updated_at: string | null;
};

export type GeoVillage = {
  id: string;
  name: string;
  /** Main village abadi only (excludes settlements). */
  population: number;
  settlements_population: number;
  total_population: number;
  settlement_count: number;
  population_updated_at: string | null;
  settlements: GeoSettlement[];
};

export type GeoTehsil = {
  tehsil: string;
  village_count: number;
  settlement_count: number;
  total_population: number;
  villages_with_population: number;
  villages: GeoVillage[];
};

export type GeographyResponse = {
  scope: GeographyScope;
  totals: GeographyTotals;
  tehsils: GeoTehsil[];
};

export type GeographySummary = {
  scope: GeographyScope;
  totals: GeographyTotals;
  by_tehsil: Array<Omit<GeoTehsil, "villages">>;
  by_village: Array<{
    tehsil: string;
    village: string;
    population: number;
    settlements_population: number;
    total_population: number;
    settlement_count: number;
    settlements: Array<{ name: string; population: number }>;
  }>;
};

export type PopulationUpdate = {
  type: "village" | "settlement";
  id: string;
  population: number;
};

export type PopulationHistoryItem = {
  id: string;
  location_type: "village" | "settlement";
  tehsil: string;
  village: string;
  settlement: string | null;
  previous_population: number;
  new_population: number;
  delta: number;
  performed_by_name: string | null;
  performed_by_role: string;
  created_at: string | null;
};

/** Treat "All …" scope sentinels as no filter. */
const scopeParam = (v?: string | null) =>
  v && !/^all\b/i.test(v.trim()) ? v : undefined;

export async function getGeography(tehsil?: string) {
  const res = await api.get("/geography", {
    params: { tehsil: scopeParam(tehsil) },
  });
  return res.data as GeographyResponse;
}

export async function getGeographySummary(params?: {
  tehsil?: string | undefined;
  village?: string | undefined;
}) {
  const res = await api.get("/geography/summary", {
    params: {
      tehsil: scopeParam(params?.tehsil),
      village: scopeParam(params?.village),
    },
  });
  return res.data as GeographySummary;
}

export async function getPopulationHistory(params?: {
  tehsil?: string;
  limit?: number;
}) {
  const res = await api.get("/geography/history", {
    params: { tehsil: scopeParam(params?.tehsil), limit: params?.limit },
  });
  return res.data as { items: PopulationHistoryItem[] };
}

export async function savePopulation(updates: PopulationUpdate[]) {
  const res = await api.patch("/geography/population", { updates });
  return res.data as { message: string; updated: number };
}

export const formatPopulation = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString("en-US");

/** Join key for tehsil + village (names differ in case/spacing across tables). */
export const villageKey = (tehsil: string, village: string) =>
  `${tehsil.trim().replace(/\s+/g, " ").toUpperCase()}|${village
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase()}`;

/**
 * Number of days the dashboard period covers, clipped to today so a running
 * month/year isn't diluted by days that haven't happened. null = open-ended.
 */
export function periodDays(p: {
  year: string;
  month: string;
  dateFrom: string;
  dateTo: string;
}): number | null {
  const DAY = 86_400_000;
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const span = (start: number, end: number) => {
    const e = Math.min(end, todayUtc);
    return e >= start ? Math.round((e - start) / DAY) + 1 : null;
  };
  const iso = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  };
  const from = iso(p.dateFrom);
  const to = iso(p.dateTo);
  if (from !== null && to !== null) return span(from, to);
  const year = Number(p.year);
  if (!Number.isInteger(year)) return null;
  const month = Number(p.month);
  if (Number.isInteger(month) && month >= 1 && month <= 12) {
    return span(Date.UTC(year, month - 1, 1), Date.UTC(year, month, 0));
  }
  return span(Date.UTC(year, 0, 1), Date.UTC(year, 11, 31));
}

// ─── Coverage: who serves whom ───────────────────────────────────────────────

export type SiteCoverage = {
  id: string;
  unique_identifier: string;
  tehsil: string;
  village: string;
  settlement: string | null;
  served_population: number;
  areas: Array<{
    kind: "village" | "settlement";
    name: string;
    population: number;
    shared_with: number;
    served: number;
  }>;
  /** Site's village isn't in the location catalog — no population attributed. */
  unmatched: boolean;
};

export type VillageCoverage = {
  tehsil: string;
  village: string;
  main_population: number;
  /** A village-level site exists, so the main abadi counts as served. */
  main_covered: boolean;
  main_served: number;
  total_population: number;
  served_population: number;
  unserved_population: number;
  site_count: number;
  settlements: Array<{
    name: string;
    population: number;
    served: number;
    site_ids: string[];
  }>;
};

export type TehsilCoverage = {
  tehsil: string;
  total_population: number;
  served_population: number;
  unserved_population: number;
  village_count: number;
  villages_served: number;
  site_count: number;
};

export type CoverageResponse = {
  scope: GeographyScope;
  totals: {
    total_population: number;
    served_population: number;
    unserved_population: number;
    served_pct: number | null;
    village_count: number;
    villages_served: number;
    site_count: number;
  };
  tehsils: TehsilCoverage[];
  villages: VillageCoverage[];
  sites: SiteCoverage[];
};

export async function getPopulationCoverage(params?: {
  tehsil?: string | undefined;
  village?: string | undefined;
}) {
  const res = await api.get("/geography/coverage", {
    params: {
      tehsil: scopeParam(params?.tehsil),
      village: scopeParam(params?.village),
    },
  });
  return res.data as CoverageResponse;
}
