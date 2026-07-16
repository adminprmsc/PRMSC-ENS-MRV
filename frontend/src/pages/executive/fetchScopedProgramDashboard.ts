import type { QueryFilters } from "@/services/types";
import { ALL_ASSIGNED_TEHSILS } from "./fetchExecutiveScopedDashboard";

export type ProgramTehsilFootprint = {
  tehsil: string;
  water_sites: number;
  solar_sites: number;
  water_logs: number;
  solar_logs: number;
  water_sites_logged: number;
  solar_sites_logged: number;
};

export type ProgramAssignedOperator = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
};

export type ProgramWaterSystemCoverage = {
  id: string;
  unique_identifier: string;
  tehsil: string;
  village: string;
  settlement: string | null;
  bulk_meter_installed: boolean;
  logs_count: number;
  days_logged: number;
  last_log_date: string | null;
  lifetime_last_log_date: string | null;
  logged: boolean;
  assigned_operators: ProgramAssignedOperator[];
};

export type ProgramSolarSystemCoverage = {
  id: string;
  unique_identifier: string;
  tehsil: string;
  village: string;
  settlement: string | null;
  logs_count: number;
  months_logged: number;
  lifetime_last_log_year: number | null;
  lifetime_last_log_month: number | null;
  logged: boolean;
};

export type ProgramSummary = {
  ohr_count: number;
  solar_facilities: number;
  bulk_meters: number;
  water_logs_count?: number;
  solar_logs_count?: number;
  water_sites_logged?: number;
  solar_sites_logged?: number;
  by_tehsil?: ProgramTehsilFootprint[];
  water_systems?: ProgramWaterSystemCoverage[];
  solar_systems?: ProgramSolarSystemCoverage[];
};

export type ProgramMonthlyRow = {
  month: number;
  total_water_pumped?: number;
  pump_operating_hours?: number;
  solar_generation_kwh?: number;
  grid_import_kwh?: number;
};

function mergeMonthlyRows(rows: ProgramMonthlyRow[][]): ProgramMonthlyRow[] {
  const byMonth = new Map<number, ProgramMonthlyRow>();

  for (const group of rows) {
    for (const row of group) {
      const m = row.month;
      if (m < 1 || m > 12) continue;
      const prev = byMonth.get(m) ?? { month: m };
      byMonth.set(m, {
        month: m,
        total_water_pumped:
          Number(prev.total_water_pumped ?? 0) +
          Number(row.total_water_pumped ?? 0),
        pump_operating_hours:
          Number(prev.pump_operating_hours ?? 0) +
          Number(row.pump_operating_hours ?? 0),
        solar_generation_kwh:
          Number(prev.solar_generation_kwh ?? 0) +
          Number(row.solar_generation_kwh ?? 0),
        grid_import_kwh:
          Number(prev.grid_import_kwh ?? 0) + Number(row.grid_import_kwh ?? 0),
      });
    }
  }

  return [...byMonth.values()].sort((a, b) => a.month - b.month);
}

function emptySummary(): ProgramSummary {
  return {
    ohr_count: 0,
    solar_facilities: 0,
    bulk_meters: 0,
    water_logs_count: 0,
    solar_logs_count: 0,
    water_sites_logged: 0,
    solar_sites_logged: 0,
    by_tehsil: [],
    water_systems: [],
    solar_systems: [],
  };
}

function normalizeWaterSystem(
  raw: Partial<ProgramWaterSystemCoverage>,
): ProgramWaterSystemCoverage {
  const logs = Number(raw.logs_count ?? 0);
  const operators = Array.isArray(raw.assigned_operators)
    ? raw.assigned_operators.map((op) => ({
        id: String(op.id ?? ""),
        name: String(op.name ?? "—"),
        email: String(op.email ?? ""),
        phone: op.phone ?? null,
      }))
    : [];
  return {
    id: String(raw.id ?? ""),
    unique_identifier: String(raw.unique_identifier ?? "—"),
    tehsil: String(raw.tehsil ?? "Unknown"),
    village: String(raw.village ?? "—"),
    settlement: raw.settlement ?? null,
    bulk_meter_installed: Boolean(raw.bulk_meter_installed),
    logs_count: logs,
    days_logged: Number(raw.days_logged ?? 0),
    last_log_date: raw.last_log_date
      ? String(raw.last_log_date).slice(0, 10)
      : null,
    lifetime_last_log_date: raw.lifetime_last_log_date
      ? String(raw.lifetime_last_log_date).slice(0, 10)
      : null,
    logged: Boolean(raw.logged ?? logs > 0),
    assigned_operators: operators,
  };
}

function normalizeSolarSystem(
  raw: Partial<ProgramSolarSystemCoverage>,
): ProgramSolarSystemCoverage {
  const logs = Number(raw.logs_count ?? 0);
  return {
    id: String(raw.id ?? ""),
    unique_identifier: String(raw.unique_identifier ?? "—"),
    tehsil: String(raw.tehsil ?? "Unknown"),
    village: String(raw.village ?? "—"),
    settlement: raw.settlement ?? null,
    logs_count: logs,
    months_logged: Number(raw.months_logged ?? 0),
    lifetime_last_log_year:
      raw.lifetime_last_log_year != null
        ? Number(raw.lifetime_last_log_year)
        : null,
    lifetime_last_log_month:
      raw.lifetime_last_log_month != null
        ? Number(raw.lifetime_last_log_month)
        : null,
    logged: Boolean(raw.logged ?? logs > 0),
  };
}

function normalizeSummary(raw: ProgramSummary | undefined): ProgramSummary {
  if (!raw) return emptySummary();
  return {
    ohr_count: Number(raw.ohr_count ?? 0),
    solar_facilities: Number(raw.solar_facilities ?? 0),
    bulk_meters: Number(raw.bulk_meters ?? 0),
    water_logs_count: Number(raw.water_logs_count ?? 0),
    solar_logs_count: Number(raw.solar_logs_count ?? 0),
    water_sites_logged: Number(raw.water_sites_logged ?? 0),
    solar_sites_logged: Number(raw.solar_sites_logged ?? 0),
    by_tehsil: Array.isArray(raw.by_tehsil) ? raw.by_tehsil : [],
    water_systems: Array.isArray(raw.water_systems)
      ? raw.water_systems.map(normalizeWaterSystem)
      : [],
    solar_systems: Array.isArray(raw.solar_systems)
      ? raw.solar_systems.map(normalizeSolarSystem)
      : [],
  };
}

function mergeTehsilFootprints(
  groups: ProgramTehsilFootprint[][],
): ProgramTehsilFootprint[] {
  const byTehsil = new Map<string, ProgramTehsilFootprint>();
  for (const group of groups) {
    for (const row of group) {
      const key = row.tehsil || "Unknown";
      const prev = byTehsil.get(key) ?? {
        tehsil: key,
        water_sites: 0,
        solar_sites: 0,
        water_logs: 0,
        solar_logs: 0,
        water_sites_logged: 0,
        solar_sites_logged: 0,
      };
      byTehsil.set(key, {
        tehsil: key,
        water_sites: prev.water_sites + Number(row.water_sites ?? 0),
        solar_sites: prev.solar_sites + Number(row.solar_sites ?? 0),
        water_logs: prev.water_logs + Number(row.water_logs ?? 0),
        solar_logs: prev.solar_logs + Number(row.solar_logs ?? 0),
        water_sites_logged:
          prev.water_sites_logged + Number(row.water_sites_logged ?? 0),
        solar_sites_logged:
          prev.solar_sites_logged + Number(row.solar_sites_logged ?? 0),
      });
    }
  }
  return [...byTehsil.values()].sort((a, b) => a.tehsil.localeCompare(b.tehsil));
}

function mergeWaterSystems(
  groups: ProgramWaterSystemCoverage[][],
): ProgramWaterSystemCoverage[] {
  const byId = new Map<string, ProgramWaterSystemCoverage>();
  for (const group of groups) {
    for (const row of group) {
      if (!row.id || byId.has(row.id)) continue;
      byId.set(row.id, row);
    }
  }
  return [...byId.values()].sort((a, b) => {
    if (a.logged !== b.logged) return a.logged ? 1 : -1;
    return (
      a.tehsil.localeCompare(b.tehsil) ||
      a.village.localeCompare(b.village) ||
      a.unique_identifier.localeCompare(b.unique_identifier)
    );
  });
}

function mergeSolarSystems(
  groups: ProgramSolarSystemCoverage[][],
): ProgramSolarSystemCoverage[] {
  const byId = new Map<string, ProgramSolarSystemCoverage>();
  for (const group of groups) {
    for (const row of group) {
      if (!row.id || byId.has(row.id)) continue;
      byId.set(row.id, row);
    }
  }
  return [...byId.values()].sort((a, b) => {
    if (a.logged !== b.logged) return a.logged ? 1 : -1;
    return (
      a.tehsil.localeCompare(b.tehsil) ||
      a.village.localeCompare(b.village) ||
      a.unique_identifier.localeCompare(b.unique_identifier)
    );
  });
}

export async function fetchScopedProgramDashboard(
  apiFilters: QueryFilters,
  allowedTehsils: string[],
  fetchers: {
    summary: (filters: QueryFilters) => Promise<ProgramSummary | undefined>;
    water: (filters: QueryFilters) => Promise<ProgramMonthlyRow[] | undefined>;
    pump: (filters: QueryFilters) => Promise<ProgramMonthlyRow[] | undefined>;
    solar: (filters: QueryFilters) => Promise<ProgramMonthlyRow[] | undefined>;
    grid: (filters: QueryFilters) => Promise<ProgramMonthlyRow[] | undefined>;
  },
) {
  const tehsil = String(apiFilters.tehsil ?? "");
  if (tehsil !== ALL_ASSIGNED_TEHSILS || allowedTehsils.length === 0) {
    const [summary, water, pump, solar, grid] = await Promise.all([
      fetchers.summary(apiFilters),
      fetchers.water(apiFilters),
      fetchers.pump(apiFilters),
      fetchers.solar(apiFilters),
      fetchers.grid(apiFilters),
    ]);
    return {
      summary: normalizeSummary(summary),
      water: water ?? [],
      pump: pump ?? [],
      solar: solar ?? [],
      grid: grid ?? [],
    };
  }

  const perTehsil = await Promise.all(
    allowedTehsils.map(async (t) => {
      const f = { ...apiFilters, tehsil: t };
      const [summary, water, pump, solar, grid] = await Promise.all([
        fetchers.summary(f),
        fetchers.water(f),
        fetchers.pump(f),
        fetchers.solar(f),
        fetchers.grid(f),
      ]);
      return { summary: normalizeSummary(summary), water, pump, solar, grid };
    }),
  );

  const summary = perTehsil.reduce(
    (acc, row) => ({
      ohr_count: acc.ohr_count + row.summary.ohr_count,
      solar_facilities: acc.solar_facilities + row.summary.solar_facilities,
      bulk_meters: acc.bulk_meters + row.summary.bulk_meters,
      water_logs_count:
        (acc.water_logs_count ?? 0) + (row.summary.water_logs_count ?? 0),
      solar_logs_count:
        (acc.solar_logs_count ?? 0) + (row.summary.solar_logs_count ?? 0),
      water_sites_logged:
        (acc.water_sites_logged ?? 0) + (row.summary.water_sites_logged ?? 0),
      solar_sites_logged:
        (acc.solar_sites_logged ?? 0) + (row.summary.solar_sites_logged ?? 0),
      by_tehsil: [] as ProgramTehsilFootprint[],
      water_systems: [] as ProgramWaterSystemCoverage[],
      solar_systems: [] as ProgramSolarSystemCoverage[],
    }),
    emptySummary(),
  );
  summary.by_tehsil = mergeTehsilFootprints(
    perTehsil.map((r) => r.summary.by_tehsil ?? []),
  );
  summary.water_systems = mergeWaterSystems(
    perTehsil.map((r) => r.summary.water_systems ?? []),
  );
  summary.solar_systems = mergeSolarSystems(
    perTehsil.map((r) => r.summary.solar_systems ?? []),
  );

  return {
    summary,
    water: mergeMonthlyRows(perTehsil.map((r) => r.water ?? [])),
    pump: mergeMonthlyRows(perTehsil.map((r) => r.pump ?? [])),
    solar: mergeMonthlyRows(perTehsil.map((r) => r.solar ?? [])),
    grid: mergeMonthlyRows(perTehsil.map((r) => r.grid ?? [])),
  };
}
