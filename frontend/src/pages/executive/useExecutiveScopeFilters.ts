import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isExecutiveRole } from "@/constants/roles";
import {
  ALL_SETTLEMENTS,
  ALL_VILLAGES,
  useLocationCatalog,
} from "@/hooks/useLocationCatalog";
import type { ExecutiveScopeFilters } from "./executiveAnalysisTypes";
import {
  buildExecutiveScopeApiFilters,
  executiveYearLabel,
  resolveExecutiveYearFromUrl,
  type ExecutivePeriodFilterMode,
} from "./executivePeriodFilters";
import { ALL_ASSIGNED_TEHSILS } from "./fetchExecutiveScopedDashboard";

/**
 * HQ analysis scope filters — tehsil / village / settlement options come from
 * the DB location catalog (single source of truth).
 */
export function useExecutiveScopeFilters(options?: {
  /** @deprecated use periodFilterMode */
  showPeriodFilters?: boolean;
  /** full = year + month, year-only = year, none = location only */
  periodFilterMode?: ExecutivePeriodFilterMode;
}) {
  const periodFilterMode: ExecutivePeriodFilterMode =
    options?.periodFilterMode ??
    (options?.showPeriodFilters === false ? "none" : "full");
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const {
    loading: catalogLoading,
    matchTehsil,
    resolveUserTehsils,
    scopeTehsilOptions,
    scopeVillageOptions,
    scopeSettlementOptions,
    tehsils: catalogTehsils,
  } = useLocationCatalog();

  const allowedTehsils = useMemo(() => {
    const fromUser = resolveUserTehsils(user?.tehsils);
    if (isExecutiveRole(user?.role)) {
      return fromUser;
    }
    return fromUser.length ? fromUser : catalogTehsils;
  }, [user?.role, user?.tehsils, resolveUserTehsils, catalogTehsils]);

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
    const urlSettlement = searchParams.get("settlement")?.trim() || "";
    const urlYear = searchParams.get("year")?.trim() || "";
    const urlMonth = searchParams.get("month")?.trim() || "";
    const matchedUrl = matchTehsil(urlTehsil);
    const tehsilOk =
      urlTehsil === ALL_ASSIGNED_TEHSILS ||
      (matchedUrl != null && allowedTehsils.includes(matchedUrl)) ||
      (!restrictTehsils && urlTehsil.length > 0);
    return {
      tehsil: tehsilOk
        ? matchedUrl && urlTehsil !== ALL_ASSIGNED_TEHSILS
          ? matchedUrl
          : urlTehsil || initialTehsil
        : initialTehsil,
      village: urlVillage || ALL_VILLAGES,
      settlement: urlSettlement || ALL_SETTLEMENTS,
      month: urlMonth || "All Months",
      year: resolveExecutiveYearFromUrl(urlYear),
    };
  }, [
    searchParams,
    allowedTehsils,
    restrictTehsils,
    initialTehsil,
    matchTehsil,
  ]);

  const [filters, setFilters] = useState<ExecutiveScopeFilters>(seedFilters);
  const [activeFilters, setActiveFilters] =
    useState<ExecutiveScopeFilters>(seedFilters);

  const tehsilOptions = useMemo(
    () =>
      scopeTehsilOptions({
        allowedTehsils: restrictTehsils ? allowedTehsils : catalogTehsils,
        includeAll: true,
        allLabel: ALL_ASSIGNED_TEHSILS,
      }),
    [
      scopeTehsilOptions,
      restrictTehsils,
      allowedTehsils,
      catalogTehsils,
    ],
  );

  const villageOptions = useMemo(
    () =>
      scopeVillageOptions(filters.tehsil, {
        allowedTehsils,
      }),
    [scopeVillageOptions, filters.tehsil, allowedTehsils],
  );

  const settlementOptions = useMemo(
    () =>
      scopeSettlementOptions(filters.tehsil, filters.village, {
        allowedTehsils,
      }),
    [scopeSettlementOptions, filters.tehsil, filters.village, allowedTehsils],
  );

  /** Village/settlement filters stay available under "All Tehsils". */
  const villageEnabled = true;
  const settlementEnabled = true;

  const locationMeta = useMemo(() => {
    const villageCount = Math.max(0, villageOptions.length - 1);
    const settlementCount = Math.max(0, settlementOptions.length - 1);
    return {
      siteCount: 0,
      villageCount,
      settlementCount,
    };
  }, [villageOptions.length, settlementOptions.length]);

  useEffect(() => {
    setFilters((prev) => {
      const next = { ...prev };
      let changed = false;

      if (
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

  const apiFilters = useMemo(
    () =>
      buildExecutiveScopeApiFilters({
        tehsil: activeFilters.tehsil,
        village: activeFilters.village,
        year: activeFilters.year,
        month: activeFilters.month,
        settlement: activeFilters.settlement,
        periodFilterMode,
      }),
    [activeFilters, periodFilterMode],
  );

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
    if (periodFilterMode === "none") {
      return `${tehsil} · ${village} · ${settlement}`;
    }
    if (periodFilterMode === "year-only") {
      return `${tehsil} · ${village} · ${settlement} · ${executiveYearLabel(activeFilters.year)}`;
    }
    const month =
      activeFilters.month === "All Months"
        ? "All months"
        : EXECUTIVE_MONTH_LABEL(Number(activeFilters.month));
    return `${tehsil} · ${village} · ${settlement} · ${executiveYearLabel(activeFilters.year)} · ${month}`;
  }, [activeFilters, allowedTehsils.length, restrictTehsils, periodFilterMode]);

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
    locationMeta,
    catalogLoading,
    applyFilters,
    updateFilter,
  };
}

function EXECUTIVE_MONTH_LABEL(month: number): string {
  const labels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return labels[month - 1] ?? String(month);
}
