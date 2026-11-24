/**
 * The frontend keeps a copy of the meter-phase rules for instant form
 * feedback (frontend/src/lib/solarMeterPhase.ts). This test fails if the two
 * drift apart. Skipped when the frontend tree isn't present (e.g. Docker).
 */
import { existsSync, readFileSync } from 'node:fs';
import * as ts from 'typescript';
import { join } from 'node:path';
import * as server from './solar-meter-phase.rules';

const FRONTEND = join(
  __dirname,
  '../../../../frontend/src/lib/solarMeterPhase.ts',
);
const maybe = existsSync(FRONTEND) ? describe : describe.skip;

maybe('solar meter-phase rules — frontend parity', () => {
  // The frontend file lives outside Jest's root, so compile it in memory.
  type Client = typeof import('../../../../frontend/src/lib/solarMeterPhase');
  const loadClient = (): Client => {
    const out = ts.transpileModule(readFileSync(FRONTEND, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText;
    const mod = { exports: {} as Record<string, unknown> };
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const run = new Function('module', 'exports', out) as (
      m: typeof mod,
      e: typeof mod.exports,
    ) => void;
    run(mod, mod.exports);
    return mod.exports as unknown as Client;
  };
  const client = loadClient();

  const greenDates = [
    null,
    '2024-01-31',
    '2025-06-15',
    '2025-12-01',
    '2026-11-24',
  ];
  const periods: Array<{ year: number; month: number }> = [];
  for (let y = 2023; y <= 2027; y++)
    for (let m = 1; m <= 12; m++) periods.push({ year: y, month: m });

  it('phaseWindow agrees for every date × month combination', () => {
    for (const g of greenDates) {
      for (const p of periods) {
        const a = server.phaseWindow(g, p);
        const b = client.phaseWindow(g, p);
        expect({
          g,
          p,
          allowed: [...b.allowed].sort(),
          def: b.defaultPhase,
          reason: b.reason,
        }).toEqual({
          g,
          p,
          allowed: [...a.allowed].sort(),
          def: a.defaultPhase,
          reason: a.reason,
        });
      }
    }
  });

  it('shares limits and Pakistan month rollover', () => {
    expect(client.MAX_MONTHLY_KWH).toBe(server.MAX_MONTHLY_KWH);
    expect(client.SOLAR_LOG_MIN_YEAR).toBe(server.SOLAR_LOG_MIN_YEAR);
    for (const iso of [
      '2026-11-30T18:59:00Z',
      '2026-11-30T19:00:00Z',
      '2026-12-31T19:30:00Z',
    ]) {
      expect(client.pakistanYearMonth(new Date(iso))).toEqual(
        server.pakistanYearMonth(new Date(iso)),
      );
    }
    expect(client.formatYearMonth({ year: 2025, month: 6 })).toBe(
      server.formatYearMonth({ year: 2025, month: 6 }),
    );
  });

  it('summarizePhases splits baseline from green-meter months', () => {
    const s = client.summarizePhases([
      {
        year: 2025,
        month: 2,
        meter_phase: 'pre_green',
        import_peak: 100,
        import_off_peak: 300,
      },
      {
        year: 2025,
        month: 1,
        meter_phase: 'pre_green',
        import_peak: 50,
        import_off_peak: 150,
      },
      {
        year: 2025,
        month: 7,
        meter_phase: 'green',
        import_peak: 20,
        import_off_peak: 40,
        export_peak: 10,
        export_off_peak: 90,
      },
      { year: 2025, month: 8, import_off_peak: 60 }, // legacy row, no phase → green
    ]);
    expect(s.preGreen).toMatchObject({
      months: 2,
      total: 600,
      avgPerMonth: 300,
      first: { year: 2025, month: 1 },
      last: { year: 2025, month: 2 },
    });
    expect(s.green).toMatchObject({
      months: 2,
      importTotal: 120,
      exportTotal: 100,
      avgImportPerMonth: 60,
    });
    expect(s.gridDrawChangePct).toBeCloseTo(-80);
    expect(client.summarizePhases([]).gridDrawChangePct).toBeNull();
  });
});
