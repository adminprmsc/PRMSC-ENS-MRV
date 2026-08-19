import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage } from "../lib/api-error";
import { getSolarMonthlyLogsBulk } from "../services/tehsilManagerOperatorService";
import type { SolarMonthlyLogTableRow } from "../types/api";

function monthOrder(a: SolarMonthlyLogTableRow, b: SolarMonthlyLogTableRow): number {
  const loc =
    `${a.tehsil}\0${a.village}\0${a.settlement}\0${a.site_type ?? ""}\0${a.solar_system_id}`.localeCompare(
      `${b.tehsil}\0${b.village}\0${b.settlement}\0${b.site_type ?? ""}\0${b.solar_system_id}`,
      undefined,
      { sensitivity: "base" },
    );
  if (loc !== 0) return loc;
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

/**
 * Loads all monthly solar supply rows for every accessible solar site in one
 * request (GET /operator/solar-monthly-logs-bulk?year=YYYY).
 * Results are cached by React Query — switching year only fetches once per session.
 */
export function useSolarMonthlyLogs(year: number) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["solarMonthlyLogsBulk", year],
    queryFn: async () => {
      const res = await getSolarMonthlyLogsBulk(year);
      return (res.records ?? []).sort(monthOrder);
    },
    staleTime: 2 * 60 * 1000,  // 2 min — solar logs don't change often
    gcTime: 10 * 60 * 1000,    // keep in cache for 10 min
    retry: 1,
  });

  const rows: SolarMonthlyLogTableRow[] = data ?? [];
  const errorMsg = error ? getApiErrorMessage(error, "Could not load monthly solar logs") : null;

  return {
    rows,
    loading: isLoading,
    error: errorMsg,
    refetch: async () => {
      await queryClient.invalidateQueries({ queryKey: ["solarMonthlyLogsBulk", year] });
    },
  };
}
