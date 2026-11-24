import { computeCoverage } from './population-coverage.util';
import { buildPopulationTree } from './population.util';

const tree = buildPopulationTree(
  ['ALIPUR'],
  [
    { id: 'v1', tehsil: 'ALIPUR', name: 'KOT', population: 1000 },
    { id: 'v2', tehsil: 'ALIPUR', name: 'BASTI', population: 300 },
    { id: 'v3', tehsil: 'ALIPUR', name: 'DRY', population: 500 },
  ],
  [
    {
      id: 's1',
      tehsil: 'ALIPUR',
      village: 'KOT',
      name: 'NORTH',
      population: 200,
    },
    {
      id: 's2',
      tehsil: 'ALIPUR',
      village: 'KOT',
      name: 'SOUTH',
      population: 101,
    },
    {
      id: 's3',
      tehsil: 'ALIPUR',
      village: 'BASTI',
      name: 'EAST',
      population: 50,
    },
  ],
);

const site = (
  id: string,
  village: string,
  settlement: string | null = null,
) => ({
  id,
  uniqueIdentifier: id.toUpperCase(),
  tehsil: 'alipur',
  village: village.toLowerCase(),
  settlement,
});

describe('computeCoverage', () => {
  it('village-level site serves main abadi + settlements without their own site', () => {
    const { sites, villages } = computeCoverage(tree, [
      site('a', 'KOT'),
      site('b', 'KOT', 'north'),
    ]);
    const a = sites.find((s) => s.id === 'a')!;
    const b = sites.find((s) => s.id === 'b')!;
    expect(a.served_population).toBe(1000 + 101); // main + SOUTH
    expect(b.served_population).toBe(200); // NORTH only
    const kot = villages.find((v) => v.village === 'KOT')!;
    expect(kot.served_population).toBe(1301);
    expect(kot.unserved_population).toBe(0);
    expect(kot.main_covered).toBe(true);
  });

  it('splits shared areas evenly without losing people', () => {
    const { sites } = computeCoverage(tree, [
      site('x', 'KOT'),
      site('y', 'KOT'),
    ]);
    const total = sites.reduce((a, s) => a + s.served_population, 0);
    expect(total).toBe(1301);
    expect(
      Math.abs(sites[0].served_population - sites[1].served_population),
    ).toBeLessThanOrEqual(2);
  });

  it('settlement-only site leaves the main abadi unserved', () => {
    const { villages, tehsils } = computeCoverage(tree, [
      site('e', 'BASTI', 'EAST'),
    ]);
    const basti = villages.find((v) => v.village === 'BASTI')!;
    expect(basti.served_population).toBe(50);
    expect(basti.main_served).toBe(0);
    expect(basti.main_covered).toBe(false);
    expect(tehsils[0]).toMatchObject({
      total_population: 1301 + 350 + 500,
      served_population: 50,
      villages_served: 1,
      site_count: 1,
    });
  });

  it('unknown settlement falls back to village level; unknown village is flagged', () => {
    const { sites } = computeCoverage(tree, [
      site('z', 'DRY', 'NOT IN CATALOG'),
      site('q', 'NOWHERE'),
    ]);
    expect(sites.find((s) => s.id === 'z')!.served_population).toBe(500);
    const q = sites.find((s) => s.id === 'q')!;
    expect(q.unmatched).toBe(true);
    expect(q.served_population).toBe(0);
  });
});
