import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { getDashboardDataYears } from "@/services/tehsilManagerOperatorService";
import { getPakistanYear } from "@/utils/pakistanTime";

export type DataYearsKind = "all" | "water" | "solar";

/**
 * Years that actually have logged data for the signed-in user's tehsils,
 * newest first. The current year is always included (so "this year" is
 * selectable before its first log), plus any `extra` years such as the
 * value already selected — a filter never shows a value missing from its list.
 */
export function useDataYears(kind: DataYearsKind = "all", extra: number[] = []) {
  const { user } = useAuth();
  const tehsils = (user?.tehsils ?? []).join(",");

  const { data, isLoading } = useQuery({
    queryKey: ["dashboardDataYears", tehsils],
    queryFn: () =>
      getDashboardDataYears(tehsils ? { tehsils } : {}),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const extraKey = extra.join(",");
  const years = useMemo(() => {
    const fromData =
      kind === "water"
        ? data?.water_years
        : kind === "solar"
          ? data?.solar_years
          : data?.years;
    const set = new Set<number>([getPakistanYear(), ...(fromData ?? [])]);
    for (const y of extraKey ? extraKey.split(",").map(Number) : []) {
      if (Number.isInteger(y) && y >= 2000) set.add(y);
    }
    return [...set].sort((a, b) => b - a);
  }, [data, kind, extraKey]);

  return { years, loading: isLoading };
}
