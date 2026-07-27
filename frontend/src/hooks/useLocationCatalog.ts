import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getLocationCatalog,
  type LocationCatalog,
} from "@/services/locationsService";
import {
  LOCATION_DATA,
  SETTLEMENT_DATA,
  TEHSIL_OPTIONS,
} from "@/utils/locationData";

/** Sentinel used in scope filters (same string as HQ “All Tehsils”). */
export const ALL_TEHSILS = "All Tehsils";
export const ALL_VILLAGES = "All Villages";
export const ALL_SETTLEMENTS = "All Settlements";

function emptyCatalog(): LocationCatalog {
  return {
    tehsils: [],
    villages_by_tehsil: {},
    settlements_by_tehsil_village: {},
    meta: {
      village_count: 0,
      settlement_count: 0,
      custom_village_count: 0,
      custom_settlement_count: 0,
    },
  };
}

/** Offline / API-failure fallback only — UI should prefer live DB catalog. */
function staticCatalog(): LocationCatalog {
  const villages_by_tehsil: Record<string, string[]> = {};
  const settlements_by_tehsil_village: Record<
    string,
    Record<string, string[]>
  > = {};
  let settlementCount = 0;
  for (const tehsil of TEHSIL_OPTIONS) {
    const villages = LOCATION_DATA[tehsil] ?? [];
    villages_by_tehsil[tehsil] = [...villages];
    settlements_by_tehsil_village[tehsil] = {};
    for (const village of villages) {
      const sets = SETTLEMENT_DATA[village] ?? [];
      if (sets.length) {
        settlements_by_tehsil_village[tehsil]![village] = [...sets];
        settlementCount += sets.length;
      }
    }
  }
  return {
    tehsils: [...TEHSIL_OPTIONS],
    villages_by_tehsil,
    settlements_by_tehsil_village,
    meta: {
      village_count: Object.values(villages_by_tehsil).reduce(
        (n, v) => n + v.length,
        0,
      ),
      settlement_count: settlementCount,
      custom_village_count: 0,
      custom_settlement_count: 0,
    },
  };
}

function resolveTehsilKey(
  catalog: LocationCatalog,
  tehsil: string | null | undefined,
): string | null {
  const raw = String(tehsil ?? "").trim();
  if (!raw) return null;
  if (raw === ALL_TEHSILS) return null;
  if (catalog.villages_by_tehsil[raw]) return raw;
  if (catalog.tehsils.includes(raw)) return raw;
  const upper = raw.toUpperCase();
  const fromList = catalog.tehsils.find((t) => t.toUpperCase() === upper);
  if (fromList) return fromList;
  const fromMap = Object.keys(catalog.villages_by_tehsil).find(
    (t) => t.toUpperCase() === upper,
  );
  return fromMap ?? null;
}

function resolveVillageKey(
  byVillage: Record<string, string[]>,
  village: string | null | undefined,
): string | null {
  const raw = String(village ?? "").trim();
  if (!raw || raw === ALL_VILLAGES) return null;
  if (byVillage[raw]) return raw;
  const upper = raw.toUpperCase();
  return Object.keys(byVillage).find((v) => v.toUpperCase() === upper) ?? null;
}

/**
 * Loads DB location catalog (includes SYSTEM_ADMIN additions).
 * Falls back to bundled static lists only if the API is unavailable.
 * All tehsil / village / settlement selects should use this hook.
 */
export function useLocationCatalog() {
  const [catalog, setCatalog] = useState<LocationCatalog>(() => emptyCatalog());
  const [loading, setLoading] = useState(true);
  const [fromApi, setFromApi] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLocationCatalog();
      setCatalog(data);
      setFromApi(true);
    } catch {
      setCatalog(staticCatalog());
      setFromApi(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const matchTehsil = useCallback(
    (raw: string | null | undefined) => resolveTehsilKey(catalog, raw),
    [catalog],
  );

  const villagesFor = useCallback(
    (tehsil: string) => {
      const key = resolveTehsilKey(catalog, tehsil);
      return key ? [...(catalog.villages_by_tehsil[key] ?? [])] : [];
    },
    [catalog],
  );

  const settlementsFor = useCallback(
    (tehsil: string, village: string) => {
      const tehsilKey = resolveTehsilKey(catalog, tehsil);
      if (!tehsilKey) return [];
      const byVillage =
        catalog.settlements_by_tehsil_village[tehsilKey] ?? {};
      const villageKey = resolveVillageKey(byVillage, village);
      return villageKey ? [...(byVillage[villageKey] ?? [])] : [];
    },
    [catalog],
  );

  const villagesForTehsils = useCallback(
    (tehsils: string[]) => {
      const set = new Set<string>();
      for (const t of tehsils) {
        for (const v of villagesFor(t)) set.add(v);
      }
      return [...set].sort((a, b) => a.localeCompare(b));
    },
    [villagesFor],
  );

  const settlementsForTehsils = useCallback(
    (tehsils: string[], village?: string) => {
      const set = new Set<string>();
      const villageFilter = String(village ?? "").trim();
      const filterByVillage =
        villageFilter.length > 0 && villageFilter !== ALL_VILLAGES;

      for (const t of tehsils) {
        const tehsilKey = resolveTehsilKey(catalog, t);
        if (!tehsilKey) continue;
        const byVillage =
          catalog.settlements_by_tehsil_village[tehsilKey] ?? {};

        if (filterByVillage) {
          const villageKey = resolveVillageKey(byVillage, villageFilter);
          if (!villageKey) continue;
          for (const s of byVillage[villageKey] ?? []) set.add(s);
          continue;
        }

        for (const list of Object.values(byVillage)) {
          for (const s of list) set.add(s);
        }
      }
      return [...set].sort((a, b) => a.localeCompare(b));
    },
    [catalog],
  );

  /** Resolve profile/API tehsil names onto catalog spellings. */
  const resolveUserTehsils = useCallback(
    (raw: Array<string | null | undefined> | null | undefined) => {
      const out: string[] = [];
      const seen = new Set<string>();
      for (const item of raw ?? []) {
        const matched = matchTehsil(item) ?? String(item ?? "").trim();
        if (!matched || seen.has(matched)) continue;
        seen.add(matched);
        out.push(matched);
      }
      return out;
    },
    [matchTehsil],
  );

  /**
   * Tehsils available for scope filters.
   * Prefer assigned user tehsils; otherwise the full catalog list.
   */
  const scopeTehsilOptions = useCallback(
    (opts?: {
      allowedTehsils?: string[];
      includeAll?: boolean;
      allLabel?: string;
    }) => {
      const allowed = (opts?.allowedTehsils ?? [])
        .map((t) => matchTehsil(t) ?? t.trim())
        .filter(Boolean);
      const base =
        allowed.length > 0
          ? allowed
          : catalog.tehsils.length > 0
            ? catalog.tehsils
            : [...TEHSIL_OPTIONS];
      const unique = [...new Set(base)];
      const includeAll = opts?.includeAll !== false && unique.length !== 1;
      if (!includeAll) return unique;
      return [opts?.allLabel ?? ALL_TEHSILS, ...unique];
    },
    [catalog.tehsils, matchTehsil],
  );

  /**
   * Village options for scope filters.
   * When tehsil is "All Tehsils", returns the union of villages across
   * allowedTehsils (or the full catalog).
   */
  const scopeVillageOptions = useCallback(
    (
      tehsil: string,
      opts?: { allowedTehsils?: string[] },
    ) => {
      if (tehsil === ALL_TEHSILS) {
        const scope =
          opts?.allowedTehsils && opts.allowedTehsils.length > 0
            ? opts.allowedTehsils
            : catalog.tehsils;
        return [ALL_VILLAGES, ...villagesForTehsils(scope)];
      }
      return [ALL_VILLAGES, ...villagesFor(tehsil)];
    },
    [catalog.tehsils, villagesFor, villagesForTehsils],
  );

  /**
   * Settlement options for scope filters.
   * Unions settlements when tehsil and/or village is "All …".
   */
  const scopeSettlementOptions = useCallback(
    (
      tehsil: string,
      village: string,
      opts?: { allowedTehsils?: string[] },
    ) => {
      const scope =
        tehsil === ALL_TEHSILS
          ? opts?.allowedTehsils && opts.allowedTehsils.length > 0
            ? opts.allowedTehsils
            : catalog.tehsils
          : [tehsil];

      if (tehsil === ALL_TEHSILS || village === ALL_VILLAGES) {
        return [
          ALL_SETTLEMENTS,
          ...settlementsForTehsils(scope, village),
        ];
      }
      return [ALL_SETTLEMENTS, ...settlementsFor(tehsil, village)];
    },
    [catalog.tehsils, settlementsFor, settlementsForTehsils],
  );

  const catalogReady = useMemo(
    () => catalog.tehsils.length > 0 || !loading,
    [catalog.tehsils.length, loading],
  );

  return {
    catalog,
    loading,
    fromApi,
    catalogReady,
    reload,
    tehsils: catalog.tehsils,
    matchTehsil,
    resolveUserTehsils,
    villagesFor,
    settlementsFor,
    villagesForTehsils,
    settlementsForTehsils,
    scopeTehsilOptions,
    scopeVillageOptions,
    scopeSettlementOptions,
  };
}
