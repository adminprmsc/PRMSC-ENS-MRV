import type { QueryFilters } from "@/services/types";
import { ALL_ASSIGNED_TEHSILS } from "./fetchExecutiveScopedDashboard";

export const ALL_VILLAGES = "All Villages";
export const ALL_SETTLEMENTS = "All Settlements";

export type RegisteredLocationSite = {
  tehsil: string;
  village: string;
  settlement?: string | null;
};

export function normalizeListPayload(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.systems)) return o.systems;
    if (Array.isArray(o.items)) return o.items;
  }
  return [];
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export function toLocationSites(raw: unknown): RegisteredLocationSite[] {
  const out: RegisteredLocationSite[] = [];
  for (const row of normalizeListPayload(raw)) {
    const r = row as Record<string, unknown>;
    const tehsil = clean(r.tehsil);
    const village = clean(r.village);
    const settlement = clean(r.settlement);
    if (!tehsil || !village) continue;
    out.push({
      tehsil,
      village,
      settlement: settlement || null,
    });
  }
  return out;
}

export async function fetchRegisteredLocationSites(
  fetchList: (filters: QueryFilters) => Promise<unknown>,
  allowedTehsils: string[],
): Promise<RegisteredLocationSite[]> {
  if (allowedTehsils.length === 0) return [];

  const results = await Promise.allSettled(
    allowedTehsils.map((tehsil) =>
      fetchList({ tehsil, village: ALL_VILLAGES }),
    ),
  );

  const byKey = new Map<string, RegisteredLocationSite>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const site of toLocationSites(result.value)) {
      const key = `${site.tehsil}|${site.village}|${site.settlement ?? ""}`;
      byKey.set(key, site);
    }
  }
  return [...byKey.values()];
}

export function buildRegisteredLocationCascade(
  sites: RegisteredLocationSite[],
  allowedTehsils: string[],
  selectedTehsil: string,
  selectedVillage: string,
) {
  const allowedSet = new Set(
    allowedTehsils.map((t) => t.trim()).filter(Boolean),
  );
  const scoped = sites.filter(
    (s) => allowedSet.size === 0 || allowedSet.has(s.tehsil),
  );

  const tehsilsWithSites = [
    ...new Set(scoped.map((s) => s.tehsil)),
  ].sort((a, b) => a.localeCompare(b));

  const inTehsil =
    selectedTehsil === ALL_ASSIGNED_TEHSILS
      ? []
      : scoped.filter((s) => s.tehsil === selectedTehsil);

  const villages = [
    ...new Set(inTehsil.map((s) => s.village).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  const inVillage =
    selectedVillage === ALL_VILLAGES
      ? []
      : inTehsil.filter((s) => s.village === selectedVillage);

  const settlements = [
    ...new Set(
      inVillage
        .map((s) => clean(s.settlement))
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));

  return {
    tehsilsWithSites,
    villageOptions: [ALL_VILLAGES, ...villages],
    settlementOptions: [ALL_SETTLEMENTS, ...settlements],
    villageCount: villages.length,
    settlementCount: settlements.length,
    siteCount: scoped.length,
  };
}
