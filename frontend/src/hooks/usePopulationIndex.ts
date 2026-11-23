import { useEffect, useMemo, useState } from "react";

import {
  getPopulationCoverage,
  villageKey,
  type CoverageResponse,
  type SiteCoverage,
  type VillageCoverage,
} from "@/services/geographyService";

export type VillagePopulation = {
  tehsil: string;
  village: string;
  total: number;
  /** People attributed to a water site (see backend population-coverage rules). */
  served: number;
  siteCount: number;
};

/**
 * Population + water-site coverage for a tehsil scope ("All …" = every tehsil
 * the caller owns). One request feeds the KPI strip, demographics and the map.
 * Fails soft: dashboards still render without it.
 */
export function usePopulationIndex(tehsil: string | undefined) {
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPopulationCoverage({ tehsil })
      .then((d) => !cancelled && setCoverage(d))
      .catch(() => !cancelled && setCoverage(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tehsil]);

  const byKey = useMemo(() => {
    const m = new Map<string, VillagePopulation>();
    for (const v of coverage?.villages ?? []) {
      m.set(villageKey(v.tehsil, v.village), {
        tehsil: v.tehsil,
        village: v.village,
        total: v.total_population,
        served: v.served_population,
        siteCount: v.site_count,
      });
    }
    return m;
  }, [coverage]);

  const villagesByKey = useMemo(() => {
    const m = new Map<string, VillageCoverage>();
    for (const v of coverage?.villages ?? []) {
      m.set(villageKey(v.tehsil, v.village), v);
    }
    return m;
  }, [coverage]);

  const siteById = useMemo(() => {
    const m = new Map<string, SiteCoverage>();
    for (const s of coverage?.sites ?? []) m.set(s.id, s);
    return m;
  }, [coverage]);

  return { coverage, byKey, villagesByKey, siteById, loading };
}
