import type { QueryFilters } from "@/services/types";
import type { SolarSystemDetailRow, WaterSystemDetailRow } from "./executiveAnalysisTypes";

export const ALL_ASSIGNED_TEHSILS = "All Tehsils";

type RowWithId = { water_system_id?: string; solar_system_id?: string };

async function mergeScopedFetches<T extends RowWithId>(
  fetchOne: (filters: QueryFilters) => Promise<{ rows?: T[] } | undefined>,
  apiFilters: QueryFilters,
  allowedTehsils: string[],
  idKey: keyof T,
): Promise<T[]> {
  if (apiFilters.tehsil !== ALL_ASSIGNED_TEHSILS || allowedTehsils.length === 0) {
    const data = await fetchOne(apiFilters);
    return (data?.rows ?? []) as T[];
  }

  const results = await Promise.all(
    allowedTehsils.map((tehsil) => fetchOne({ ...apiFilters, tehsil })),
  );

  const byId = new Map<string, T>();
  for (const data of results) {
    for (const row of (data?.rows ?? []) as T[]) {
      const id = String(row[idKey] ?? "");
      if (id) byId.set(id, row);
    }
  }

  const sortKey = (row: T) => {
    const r = row as {
      tehsil?: string;
      village?: string;
      unique_identifier?: string;
    };
    const id = String(row[idKey] ?? "");
    return `${r.tehsil ?? ""}-${r.village ?? ""}-${r.unique_identifier ?? id}`;
  };

  return [...byId.values()].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

export function fetchScopedWaterSystems(
  fetchOne: (filters: QueryFilters) => Promise<{ rows?: WaterSystemDetailRow[] } | undefined>,
  apiFilters: QueryFilters,
  allowedTehsils: string[],
) {
  return mergeScopedFetches(
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
  return mergeScopedFetches(
    fetchOne,
    apiFilters,
    allowedTehsils,
    "solar_system_id",
  );
}
