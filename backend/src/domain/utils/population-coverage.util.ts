/**
 * Which water site serves which people.
 *
 * Attribution rules (each person counted at most once):
 *  1. A site registered in a settlement serves that settlement.
 *  2. A site registered at village level (no settlement, or a settlement not in
 *     the catalog) serves the main village abadi AND every settlement of that
 *     village that has no site of its own.
 *  3. When several sites serve the same area, its population is split evenly
 *     between them (remainder goes to the first site by id, so totals are exact).
 *  4. A settlement-only village (no village-level site) leaves the main abadi
 *     and the other settlements unserved.
 */
import type { TehsilNode } from './population.util';

export type CoverageSiteInput = {
  id: string;
  uniqueIdentifier: string;
  tehsil: string;
  village: string;
  settlement: string | null;
};

export type SiteArea = {
  kind: 'village' | 'settlement';
  /** Village name for kind=village, settlement name for kind=settlement. */
  name: string;
  population: number;
  /** Number of sites sharing this area. */
  shared_with: number;
  served: number;
};

export type SiteCoverage = {
  id: string;
  unique_identifier: string;
  tehsil: string;
  village: string;
  settlement: string | null;
  served_population: number;
  areas: SiteArea[];
  /** true when the site's village isn't in the location catalog. */
  unmatched: boolean;
};

export type SettlementCoverage = {
  name: string;
  population: number;
  served: number;
  site_ids: string[];
};

export type VillageCoverage = {
  tehsil: string;
  village: string;
  main_population: number;
  /** A village-level site exists, so the main abadi counts as served. */
  main_covered: boolean;
  main_served: number;
  total_population: number;
  served_population: number;
  unserved_population: number;
  site_count: number;
  settlements: SettlementCoverage[];
};

export type TehsilCoverage = {
  tehsil: string;
  total_population: number;
  served_population: number;
  unserved_population: number;
  village_count: number;
  villages_served: number;
  site_count: number;
};

const norm = (s: string | null | undefined) =>
  String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

/** Split `total` evenly over sorted ids; remainder to the first ids. */
function split(total: number, ids: string[]): Map<string, number> {
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const sorted = [...ids].sort();
  const base = Math.floor(total / sorted.length);
  let rem = total - base * sorted.length;
  for (const id of sorted) {
    out.set(id, base + (rem > 0 ? 1 : 0));
    if (rem > 0) rem -= 1;
  }
  return out;
}

export function computeCoverage(
  tree: TehsilNode[],
  sites: CoverageSiteInput[],
): {
  sites: SiteCoverage[];
  villages: VillageCoverage[];
  tehsils: TehsilCoverage[];
} {
  const siteOut = new Map<string, SiteCoverage>();
  for (const s of sites) {
    siteOut.set(s.id, {
      id: s.id,
      unique_identifier: s.uniqueIdentifier,
      tehsil: s.tehsil,
      village: s.village,
      settlement: s.settlement,
      served_population: 0,
      areas: [],
      unmatched: true,
    });
  }

  const sitesByVillage = new Map<string, CoverageSiteInput[]>();
  for (const s of sites) {
    const k = `${norm(s.tehsil)}|${norm(s.village)}`;
    const list = sitesByVillage.get(k) ?? [];
    list.push(s);
    sitesByVillage.set(k, list);
  }

  const credit = (
    id: string,
    area: Omit<SiteArea, 'served'>,
    served: number,
  ) => {
    const site = siteOut.get(id);
    if (!site) return;
    site.served_population += served;
    site.areas.push({ ...area, served });
  };

  const villages: VillageCoverage[] = [];
  const tehsils: TehsilCoverage[] = [];

  for (const t of tree) {
    let tServed = 0;
    let tSites = 0;
    let tVillagesServed = 0;
    for (const v of t.villages) {
      const vSites =
        sitesByVillage.get(`${norm(t.tehsil)}|${norm(v.name)}`) ?? [];
      for (const s of vSites) {
        const so = siteOut.get(s.id);
        if (so) so.unmatched = false;
      }
      const settlementNames = new Map(
        v.settlements.map((s) => [norm(s.name), s] as const),
      );
      const bySettlement = new Map<string, string[]>();
      const villageLevel: string[] = [];
      for (const s of vSites) {
        const sn = norm(s.settlement);
        if (sn && settlementNames.has(sn)) {
          const list = bySettlement.get(sn) ?? [];
          list.push(s.id);
          bySettlement.set(sn, list);
        } else {
          villageLevel.push(s.id);
        }
      }

      // Main abadi → village-level sites.
      let mainServed = 0;
      if (villageLevel.length) {
        mainServed = v.population;
        for (const [id, n] of split(v.population, villageLevel)) {
          credit(
            id,
            {
              kind: 'village',
              name: v.name,
              population: v.population,
              shared_with: villageLevel.length,
            },
            n,
          );
        }
      }

      const settlementsOut: SettlementCoverage[] = [];
      let settlementsServed = 0;
      for (const s of v.settlements) {
        const own = bySettlement.get(norm(s.name)) ?? [];
        const servers = own.length ? own : villageLevel;
        const served = servers.length ? s.population : 0;
        settlementsServed += served;
        for (const [id, n] of split(s.population, servers)) {
          credit(
            id,
            {
              kind: 'settlement',
              name: s.name,
              population: s.population,
              shared_with: servers.length,
            },
            n,
          );
        }
        settlementsOut.push({
          name: s.name,
          population: s.population,
          served,
          site_ids: [...servers].sort(),
        });
      }

      const served = mainServed + settlementsServed;
      tServed += served;
      tSites += vSites.length;
      if (vSites.length) tVillagesServed += 1;
      villages.push({
        tehsil: t.tehsil,
        village: v.name,
        main_population: v.population,
        main_covered: villageLevel.length > 0,
        main_served: mainServed,
        total_population: v.total_population,
        served_population: served,
        unserved_population: v.total_population - served,
        site_count: vSites.length,
        settlements: settlementsOut,
      });
    }
    tehsils.push({
      tehsil: t.tehsil,
      total_population: t.total_population,
      served_population: tServed,
      unserved_population: t.total_population - tServed,
      village_count: t.village_count,
      villages_served: tVillagesServed,
      site_count: tSites,
    });
  }

  return {
    sites: [...siteOut.values()].sort(
      (a, b) => b.served_population - a.served_population,
    ),
    villages,
    tehsils,
  };
}
