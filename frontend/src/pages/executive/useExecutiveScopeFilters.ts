import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TEHSIL_OPTIONS } from "@/utils/locationData";
import { useAuth } from "@/contexts/AuthContext";
import { isExecutiveRole } from "@/constants/roles";
import type { ExecutiveScopeFilters } from "./executiveAnalysisTypes";
import { ALL_ASSIGNED_TEHSILS } from "./fetchExecutiveScopedDashboard";
import {
  ALL_SETTLEMENTS,
  ALL_VILLAGES,
  buildRegisteredLocationCascade,
  type RegisteredLocationSite,
} from "./registeredLocationOptions";

export function useExecutiveScopeFilters(
  locationSites: RegisteredLocationSite[] = [],
) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

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

  const seedFilters = useMemo((): ExecutiveScopeFilters => {
    const urlTehsil = searchParams.get("tehsil")?.trim() || "";
    const urlVillage = searchParams.get("village")?.trim() || "";
    const urlYear = searchParams.get("year")?.trim() || "";
    const urlMonth = searchParams.get("month")?.trim() || "";
    const tehsilOk =
      urlTehsil === ALL_ASSIGNED_TEHSILS ||
      allowedTehsils.includes(urlTehsil) ||
      (!restrictTehsils && urlTehsil.length > 0);
    return {
      tehsil: tehsilOk ? urlTehsil : initialTehsil,
      village: urlVillage || ALL_VILLAGES,
      settlement: ALL_SETTLEMENTS,
      month: urlMonth || "All Months",
      year: urlYear || "2026",
    };
  }, [searchParams, allowedTehsils, restrictTehsils, initialTehsil]);

  const [filters, setFilters] = useState<ExecutiveScopeFilters>(seedFilters);
  const [activeFilters, setActiveFilters] =
    useState<ExecutiveScopeFilters>(seedFilters);

  const cascade = useMemo(
    () =>
      buildRegisteredLocationCascade(
        locationSites,
        allowedTehsils,
        filters.tehsil,
        filters.village,
      ),
    [locationSites, allowedTehsils, filters.tehsil, filters.village],
  );

  const tehsilOptions = useMemo(() => {
    const withSites = cascade.tehsilsWithSites.filter((t) =>
      allowedTehsils.includes(t),
    );
    const base =
      withSites.length > 0
        ? withSites
        : restrictTehsils
          ? allowedTehsils
          : allowedTehsils;

    if (restrictTehsils) {
      return base.length > 1 ? [ALL_ASSIGNED_TEHSILS, ...base] : base;
    }
    return [ALL_ASSIGNED_TEHSILS, ...base];
  }, [cascade.tehsilsWithSites, allowedTehsils, restrictTehsils]);

  const villageOptions = cascade.villageOptions;
  const settlementOptions = cascade.settlementOptions;

  const villageEnabled = filters.tehsil !== ALL_ASSIGNED_TEHSILS;
  const settlementEnabled =
    villageEnabled && filters.village !== ALL_VILLAGES;

  // Keep draft selections valid as registered sites / cascade change
  useEffect(() => {
    setFilters((prev) => {
      const next = { ...prev };
      let changed = false;

      if (prev.tehsil === ALL_ASSIGNED_TEHSILS) {
        if (
          prev.village !== ALL_VILLAGES ||
          prev.settlement !== ALL_SETTLEMENTS
        ) {
          next.village = ALL_VILLAGES;
          next.settlement = ALL_SETTLEMENTS;
          changed = true;
        }
      } else if (
        prev.village !== ALL_VILLAGES &&
        !villageOptions.includes(prev.village)
      ) {
        next.village = ALL_VILLAGES;
        next.settlement = ALL_SETTLEMENTS;
        changed = true;
      } else if (
        prev.settlement !== ALL_SETTLEMENTS &&
        !settlementOptions.includes(prev.settlement)
      ) {
        next.settlement = ALL_SETTLEMENTS;
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [villageOptions, settlementOptions]);

  const apiFilters = useMemo(() => {
    const base: Record<string, string | number> = {
      tehsil: activeFilters.tehsil,
      village: activeFilters.village,
      year: Number(activeFilters.year),
    };
    if (activeFilters.month !== "All Months") {
      base.month = Number(activeFilters.month);
    }
    if (activeFilters.settlement !== ALL_SETTLEMENTS) {
      base.settlement = activeFilters.settlement;
    }
    return base;
  }, [activeFilters]);

  const activeScopeLabel = useMemo(() => {
    const tehsil =
      activeFilters.tehsil === ALL_ASSIGNED_TEHSILS
        ? restrictTehsils
          ? `All assigned tehsils (${allowedTehsils.length})`
          : "All tehsils"
        : activeFilters.tehsil;
    const village =
      activeFilters.village === ALL_VILLAGES
        ? "All villages"
        : activeFilters.village;
    const settlement =
      activeFilters.settlement === ALL_SETTLEMENTS
        ? "All settlements"
        : activeFilters.settlement;
    const month =
      activeFilters.month === "All Months"
        ? "All months"
        : EXECUTIVE_MONTH_LABEL(Number(activeFilters.month));
    return `${tehsil} · ${village} · ${settlement} · ${activeFilters.year} · ${month}`;
  }, [activeFilters, allowedTehsils.length, restrictTehsils]);

  const applyFilters = useCallback(() => {
    setActiveFilters(filters);
  }, [filters]);

  const updateFilter = useCallback(
    <K extends keyof ExecutiveScopeFilters>(
      key: K,
      value: ExecutiveScopeFilters[K],
    ) => {
      setFilters((prev) => {
        const next = { ...prev, [key]: value };
        if (key === "tehsil") {
          next.village = ALL_VILLAGES;
          next.settlement = ALL_SETTLEMENTS;
        } else if (key === "village") {
          next.settlement = ALL_SETTLEMENTS;
        }
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
    settlementOptions,
    villageEnabled,
    settlementEnabled,
    locationMeta: {
      siteCount: cascade.siteCount,
      villageCount: cascade.villageCount,
      settlementCount: cascade.settlementCount,
    },
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
