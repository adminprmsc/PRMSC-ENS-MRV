import type { QueryFilters } from "@/services/types";
import { ALL_ASSIGNED_TEHSILS } from "./fetchExecutiveScopedDashboard";

export type ProgramSummary = {
  ohr_count: number;
  solar_facilities: number;
  bulk_meters: number;
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
  return { ohr_count: 0, solar_facilities: 0, bulk_meters: 0 };
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
      summary: summary ?? emptySummary(),
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
      return { summary, water, pump, solar, grid };
    }),
  );

  const summary = perTehsil.reduce(
    (acc, row) => ({
      ohr_count: acc.ohr_count + Number(row.summary?.ohr_count ?? 0),
      solar_facilities:
        acc.solar_facilities + Number(row.summary?.solar_facilities ?? 0),
      bulk_meters: acc.bulk_meters + Number(row.summary?.bulk_meters ?? 0),
    }),
    emptySummary(),
  );

  return {
    summary,
    water: mergeMonthlyRows(perTehsil.map((r) => r.water ?? [])),
    pump: mergeMonthlyRows(perTehsil.map((r) => r.pump ?? [])),
    solar: mergeMonthlyRows(perTehsil.map((r) => r.solar ?? [])),
    grid: mergeMonthlyRows(perTehsil.map((r) => r.grid ?? [])),
  };
}
