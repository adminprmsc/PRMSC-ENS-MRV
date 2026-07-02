import { useCallback, useMemo, useState } from "react";
import { LOCATION_DATA, TEHSIL_OPTIONS } from "@/utils/locationData";
import { useAuth } from "@/contexts/AuthContext";
import { isExecutiveRole } from "@/constants/roles";
import type { ExecutiveScopeFilters } from "./executiveAnalysisTypes";
import { ALL_ASSIGNED_TEHSILS } from "./fetchExecutiveScopedDashboard";

export function useExecutiveScopeFilters() {
  const { user } = useAuth();

  const allowedTehsils = useMemo(() => {
    const t = (user?.tehsils ?? [])
      .map((x) => String(x).trim())
      .filter(Boolean);
    if (isExecutiveRole(user?.role)) {
      return t;
    }
    return t.length ? t : [...TEHSIL_OPTIONS];
  }, [user?.role, user?.tehsils]);

  const restrictTehsils =
    isExecutiveRole(user?.role) || (user?.tehsils ?? []).length > 0;

  const initialTehsil =
    restrictTehsils && allowedTehsils.length > 1
      ? ALL_ASSIGNED_TEHSILS
      : restrictTehsils
        ? String(allowedTehsils[0] ?? "").trim() || ALL_ASSIGNED_TEHSILS
        : ALL_ASSIGNED_TEHSILS;

  const [filters, setFilters] = useState<ExecutiveScopeFilters>(() => ({
    tehsil: initialTehsil,
    village: "All Villages",
    month: "All Months",
    year: "2026",
  }));
  const [activeFilters, setActiveFilters] = useState<ExecutiveScopeFilters>(() => ({
    tehsil: initialTehsil,
    village: "All Villages",
    month: "All Months",
    year: "2026",
  }));

  const tehsilOptions = useMemo(() => {
    if (restrictTehsils) {
      return allowedTehsils.length > 1
        ? [ALL_ASSIGNED_TEHSILS, ...allowedTehsils]
        : allowedTehsils;
    }
    return [ALL_ASSIGNED_TEHSILS, ...allowedTehsils];
  }, [allowedTehsils, restrictTehsils]);

  const villageOptions = useMemo(() => {
    if (filters.tehsil === ALL_ASSIGNED_TEHSILS) {
      if (restrictTehsils && allowedTehsils.length) {
        const villages = new Set<string>();
        for (const tehsil of allowedTehsils) {
          for (const village of (LOCATION_DATA[tehsil.toUpperCase()] ||
            []) as string[]) {
            villages.add(village);
          }
        }
        return ["All Villages", ...[...villages].sort()];
      }
      return ["All Villages"];
    }
    return [
      "All Villages",
      ...((LOCATION_DATA[filters.tehsil.toUpperCase()] || []) as string[]),
    ];
  }, [filters.tehsil, restrictTehsils, allowedTehsils]);

  const apiFilters = useMemo(
    () => ({
      tehsil: activeFilters.tehsil,
      village: activeFilters.village,
      year: Number(activeFilters.year),
      ...(activeFilters.month !== "All Months"
        ? { month: Number(activeFilters.month) }
        : {}),
    }),
    [activeFilters],
  );

  const activeScopeLabel = useMemo(() => {
    const tehsil =
      activeFilters.tehsil === ALL_ASSIGNED_TEHSILS
        ? restrictTehsils
          ? `All assigned tehsils (${allowedTehsils.length})`
          : "All tehsils"
        : activeFilters.tehsil;
    const village =
      activeFilters.village === "All Villages"
        ? "All villages"
        : activeFilters.village;
    const month =
      activeFilters.month === "All Months"
        ? "All months"
        : EXECUTIVE_MONTH_LABEL(Number(activeFilters.month));
    return `${tehsil} · ${village} · ${activeFilters.year} · ${month}`;
  }, [activeFilters, allowedTehsils.length, restrictTehsils]);

  const applyFilters = useCallback(() => {
    setActiveFilters(filters);
  }, [filters]);

  const updateFilter = useCallback(
    <K extends keyof ExecutiveScopeFilters>(key: K, value: ExecutiveScopeFilters[K]) => {
      setFilters((prev) => {
        const next = { ...prev, [key]: value };
        if (key === "tehsil") next.village = "All Villages";
        return next;
      });
    },
    [],
  );

  return {
    filters,
    activeFilters,
    apiFilters,
    activeScopeLabel,
    allowedTehsils,
    restrictTehsils,
    tehsilOptions,
    villageOptions,
    applyFilters,
    updateFilter,
  };
}

function EXECUTIVE_MONTH_LABEL(month: number): string {
  const labels = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return labels[month - 1] ?? String(month);
}
