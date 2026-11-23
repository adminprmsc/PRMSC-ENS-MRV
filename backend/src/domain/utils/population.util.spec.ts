import {
  MAX_POPULATION,
  buildPopulationTree,
  parsePopulation,
} from './population.util';

describe('buildPopulationTree', () => {
  const villages = [
    { id: 'v1', tehsil: 'ALIPUR', name: 'B VILLAGE', population: 100 },
    { id: 'v2', tehsil: 'ALIPUR', name: 'A VILLAGE', population: 0 },
    { id: 'v3', tehsil: 'TAUNSA', name: 'T VILLAGE', population: 40 },
  ];
  const settlements = [
    {
      id: 's1',
      tehsil: 'ALIPUR',
      village: 'B VILLAGE',
      name: 'S1',
      population: 25,
    },
    {
      id: 's2',
      tehsil: 'ALIPUR',
      village: 'b village',
      name: 'S2',
      population: 5,
    },
    // orphan (parent village inactive / missing) — ignored
    {
      id: 's3',
      tehsil: 'ALIPUR',
      village: 'GONE',
      name: 'S3',
      population: 999,
    },
  ];

  it('rolls village + settlements up to tehsil totals', () => {
    const [alipur, taunsa] = buildPopulationTree(
      ['ALIPUR', 'TAUNSA'],
      villages,
      settlements,
    );
    expect(alipur.total_population).toBe(130);
    expect(alipur.village_count).toBe(2);
    expect(alipur.settlement_count).toBe(2);
    expect(alipur.villages_with_population).toBe(1);
    expect(alipur.villages.map((v) => v.name)).toEqual([
      'A VILLAGE',
      'B VILLAGE',
    ]);

    const b = alipur.villages[1];
    expect(b.population).toBe(100);
    expect(b.settlements_population).toBe(30);
    expect(b.total_population).toBe(130);
    expect(b.settlements.map((s) => s.name)).toEqual(['S1', 'S2']);

    expect(taunsa.total_population).toBe(40);
  });

  it('returns empty nodes for tehsils with no villages', () => {
    const [kot] = buildPopulationTree(['KOT MOMIN'], villages, settlements);
    expect(kot).toMatchObject({
      tehsil: 'KOT MOMIN',
      village_count: 0,
      total_population: 0,
      villages: [],
    });
  });

  it('treats negative / non-numeric stored values as 0', () => {
    const [t] = buildPopulationTree(
      ['ALIPUR'],
      [{ id: 'v', tehsil: 'ALIPUR', name: 'X', population: -5 }],
      [{ id: 's', tehsil: 'ALIPUR', village: 'X', name: 'Y', population: NaN }],
    );
    expect(t.total_population).toBe(0);
  });
});

describe('parsePopulation', () => {
  it.each([
    [0, 0],
    [42, 42],
    ['1500', 1500],
    [' 7 ', 7],
    [MAX_POPULATION, MAX_POPULATION],
  ])('%p → %p', (raw, out) => {
    expect(parsePopulation(raw)).toBe(out);
  });

  it.each([-1, 1.5, 'abc', '', null, undefined, MAX_POPULATION + 1, NaN])(
    '%p → null',
    (raw) => {
      expect(parsePopulation(raw)).toBeNull();
    },
  );
});
