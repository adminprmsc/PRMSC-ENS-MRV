import type { QueryFilters } from "@/services/types";
import type { SolarSystemDetailRow, WaterSystemDetailRow } from "./executiveAnalysisTypes";
import { buildScopedApiFilters } from "./buildScopedApiFilters";

export const ALL_ASSIGNED_TEHSILS = "All Tehsils";

type RowWithId = { water_system_id?: string; solar_system_id?: string };

async function fetchScopedDetailRows<T extends RowWithId>(
  fetchOne: (filters: QueryFilters) => Promise<{ rows?: T[] } | undefined>,
  apiFilters: QueryFilters,
  allowedTehsils: string[],
  idKey: keyof T,
): Promise<T[]> {
  const scoped = buildScopedApiFilters(apiFilters, allowedTehsils);
  const data = await fetchOne(scoped);
  const rows = (data?.rows ?? []) as T[];

  const sortKey = (row: T) => {
    const r = row as {
      tehsil?: string;
      village?: string;
      unique_identifier?: string;
    };
    const id = String(row[idKey] ?? "");
    return `${r.tehsil ?? ""}-${r.village ?? ""}-${r.unique_identifier ?? id}`;
  };

  return [...rows].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

export function fetchScopedWaterSystems(
  fetchOne: (filters: QueryFilters) => Promise<{ rows?: WaterSystemDetailRow[] } | undefined>,
  apiFilters: QueryFilters,
  allowedTehsils: string[],
) {
  return fetchScopedDetailRows(
    fetchOne,
    apiFilters,
    allowedTehsils,
    "water_system_id",
  );
}

export function fetchScopedSolarSystems(
  fetchOne: (filters: QueryFilters) => Promise<{ rows?: SolarSystemDetailRow[] } | undefined>,
  apiFilters: QueryFilters,
  allowedTehsils: string[],
) {
  return fetchScopedDetailRows(
    fetchOne,
    apiFilters,
    allowedTehsils,
    "solar_system_id",
  );
}
