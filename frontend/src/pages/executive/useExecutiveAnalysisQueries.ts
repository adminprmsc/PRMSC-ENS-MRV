import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  getDashboardSolarSystemsDetail as getDashboardSolarSystemsDetailService,
  getDashboardWaterSystemsDetail as getDashboardWaterSystemsDetailService,
} from "@/services/tehsilManagerOperatorService";
import type { QueryFilters } from "@/services/types";
import { buildScopedApiFilters } from "./buildScopedApiFilters";
import type { SolarSystemDetailRow, WaterSystemDetailRow } from "./executiveAnalysisTypes";

const ANALYSIS_STALE_MS = 60_000;

function sortDetailRows<T extends WaterSystemDetailRow | SolarSystemDetailRow>(
  rows: T[],
  idKey: "water_system_id" | "solar_system_id",
): T[] {
  const sortKey = (row: T) =>
    `${row.tehsil ?? ""}-${row.village ?? ""}-${row.unique_identifier ?? String(row[idKey] ?? "")}`;
  return [...rows].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

export function useExecutiveWaterSystemsDetail(
  apiFilters: QueryFilters,
  allowedTehsils: string[],
) {
  const scopedFilters = useMemo(
    () => buildScopedApiFilters(apiFilters, allowedTehsils),
    [apiFilters, allowedTehsils],
  );

  return useQuery({
    queryKey: ["dashboard", "water-systems-detail", scopedFilters],
    queryFn: async () => {
      const data = await getDashboardWaterSystemsDetailService(scopedFilters);
      const rows = (data?.rows ?? []) as WaterSystemDetailRow[];
      return sortDetailRows(rows, "water_system_id");
    },
    staleTime: ANALYSIS_STALE_MS,
  });
}

export function useExecutiveSolarSystemsDetail(
  apiFilters: QueryFilters,
  allowedTehsils: string[],
) {
  const scopedFilters = useMemo(
    () => buildScopedApiFilters(apiFilters, allowedTehsils),
    [apiFilters, allowedTehsils],
  );

  return useQuery({
    queryKey: ["dashboard", "solar-systems-detail", scopedFilters],
    queryFn: async () => {
      const data = await getDashboardSolarSystemsDetailService(scopedFilters);
      const rows = (data?.rows ?? []) as SolarSystemDetailRow[];
      return sortDetailRows(rows, "solar_system_id");
    },
    staleTime: ANALYSIS_STALE_MS,
  });
}
