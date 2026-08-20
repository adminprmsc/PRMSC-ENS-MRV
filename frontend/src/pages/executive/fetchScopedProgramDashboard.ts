import type { QueryFilters } from "@/services/types";
import { buildScopedApiFilters } from "./buildScopedApiFilters";

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
  site_type: string | null;
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
    site_type: raw.site_type ?? null,
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
  const scopedFilters = buildScopedApiFilters(apiFilters, allowedTehsils);
  const [summary, water, pump, solar, grid] = await Promise.all([
    fetchers.summary(scopedFilters),
    fetchers.water(scopedFilters),
    fetchers.pump(scopedFilters),
    fetchers.solar(scopedFilters),
    fetchers.grid(scopedFilters),
  ]);
  return {
    summary: normalizeSummary(summary),
    water: water ?? [],
    pump: pump ?? [],
    solar: solar ?? [],
    grid: grid ?? [],
  };
}
