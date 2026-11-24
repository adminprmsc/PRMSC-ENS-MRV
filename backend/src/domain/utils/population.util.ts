/**
 * Geography population roll-ups.
 *
 * Counting model (no double counting):
 *   village.population      = residents of the main village abadi only
 *   settlement.population   = residents of that settlement
 *   village total           = village.population + Σ settlement.population
 *   tehsil total            = Σ village totals
 */

export const MAX_POPULATION = 10_000_000;

export type PopulationVillageInput = {
  id: string;
  tehsil: string;
  name: string;
  population: number;
  populationUpdatedAt?: Date | null;
};

export type PopulationSettlementInput = {
  id: string;
  tehsil: string;
  village: string;
  name: string;
  population: number;
  populationUpdatedAt?: Date | null;
};

export type SettlementNode = {
  id: string;
  name: string;
  population: number;
  population_updated_at: string | null;
};

export type VillageNode = {
  id: string;
  name: string;
  /** Main village abadi only. */
  population: number;
  settlements_population: number;
  total_population: number;
  settlement_count: number;
  population_updated_at: string | null;
  settlements: SettlementNode[];
};

export type TehsilNode = {
  tehsil: string;
  village_count: number;
  settlement_count: number;
  total_population: number;
  /** Villages with total population > 0. */
  villages_with_population: number;
  villages: VillageNode[];
};

const key = (...parts: string[]) =>
  parts.map((p) => p.trim().toUpperCase()).join('\0');

const iso = (d: Date | null | undefined) =>
  d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null;

const safe = (n: unknown) => {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
};

/**
 * Build tehsil → village → settlement tree with totals.
 * Settlements whose parent village is not in `villages` are ignored
 * (an inactive village hides its settlements).
 */
export function buildPopulationTree(
  tehsils: readonly string[],
  villages: readonly PopulationVillageInput[],
  settlements: readonly PopulationSettlementInput[],
): TehsilNode[] {
  const settlementsByVillage = new Map<string, SettlementNode[]>();
  for (const s of settlements) {
    const k = key(s.tehsil, s.village);
    const list = settlementsByVillage.get(k) ?? [];
    list.push({
      id: s.id,
      name: s.name,
      population: safe(s.population),
      population_updated_at: iso(s.populationUpdatedAt),
    });
    settlementsByVillage.set(k, list);
  }

  const villagesByTehsil = new Map<string, VillageNode[]>();
  for (const v of villages) {
    const sets = (settlementsByVillage.get(key(v.tehsil, v.name)) ?? []).sort(
      (a, b) => a.name.localeCompare(b.name),
    );
    const settlementsPopulation = sets.reduce((a, s) => a + s.population, 0);
    const own = safe(v.population);
    const list = villagesByTehsil.get(v.tehsil) ?? [];
    list.push({
      id: v.id,
      name: v.name,
      population: own,
      settlements_population: settlementsPopulation,
      total_population: own + settlementsPopulation,
      settlement_count: sets.length,
      population_updated_at: iso(v.populationUpdatedAt),
      settlements: sets,
    });
    villagesByTehsil.set(v.tehsil, list);
  }

  return tehsils.map((tehsil) => {
    const vs = (villagesByTehsil.get(tehsil) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    return {
      tehsil,
      village_count: vs.length,
      settlement_count: vs.reduce((a, v) => a + v.settlement_count, 0),
      total_population: vs.reduce((a, v) => a + v.total_population, 0),
      villages_with_population: vs.filter((v) => v.total_population > 0).length,
      villages: vs,
    };
  });
}

/** Parse a requested population value; returns null when invalid. */
export function parsePopulation(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'string' ? Number(raw.trim()) : Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > MAX_POPULATION) return null;
  return n;
}
