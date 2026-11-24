import {
  MAX_MONTHLY_KWH,
  normalizeSolarLog,
  pakistanYearMonth,
  phaseConflicts,
  phaseWindow,
  validateLogPeriod,
  yearMonthOf,
} from './solar-meter-phase.rules';

// 2026-11-24 10:00 UTC → Pakistan Nov 2026.
const NOW = new Date('2026-11-24T10:00:00Z');
const G = '2025-06-15'; // green meter connected mid-June 2025

describe('pakistanYearMonth', () => {
  it('rolls into the next month at 19:00 UTC on the last day (PKT midnight)', () => {
    expect(pakistanYearMonth(new Date('2026-11-30T18:59:00Z'))).toEqual({
      year: 2026,
      month: 11,
    });
    expect(pakistanYearMonth(new Date('2026-11-30T19:00:00Z'))).toEqual({
      year: 2026,
      month: 12,
    });
    expect(pakistanYearMonth(new Date('2026-12-31T19:30:00Z'))).toEqual({
      year: 2027,
      month: 1,
    });
  });
});

describe('yearMonthOf', () => {
  it.each([
    ['2025-06-15', { year: 2025, month: 6 }],
    [new Date('2025-01-01T00:00:00Z'), { year: 2025, month: 1 }],
    ['2025-12-31T00:00:00.000Z', { year: 2025, month: 12 }],
  ])('%p', (v, out) => expect(yearMonthOf(v)).toEqual(out));
  it.each([null, undefined, '', 'nope'])('%p → null', (v) =>
    expect(yearMonthOf(v as never)).toBeNull(),
  );
});

describe('phaseWindow', () => {
  it('before the green meter month → pre_green only', () => {
    expect(phaseWindow(G, { year: 2025, month: 5 })).toMatchObject({
      allowed: ['pre_green'],
      reason: 'before_green_meter',
    });
    expect(phaseWindow(G, { year: 2024, month: 12 }).allowed).toEqual([
      'pre_green',
    ]);
  });
  it('the connection month allows both, defaults to green', () => {
    const w = phaseWindow(G, { year: 2025, month: 6 });
    expect(w.allowed.sort()).toEqual(['green', 'pre_green']);
    expect(w.defaultPhase).toBe('green');
  });
  it('after the connection month → green only (incl. across year boundary)', () => {
    expect(phaseWindow(G, { year: 2025, month: 7 }).allowed).toEqual(['green']);
    expect(phaseWindow('2025-12-01', { year: 2026, month: 1 }).allowed).toEqual(
      ['green'],
    );
    expect(
      phaseWindow('2025-12-01', { year: 2025, month: 11 }).allowed,
    ).toEqual(['pre_green']);
  });
  it('unknown green meter date allows both, defaults to green (legacy)', () => {
    const w = phaseWindow(null, { year: 2020, month: 1 });
    expect(w.allowed.sort()).toEqual(['green', 'pre_green']);
    expect(w).toMatchObject({
      defaultPhase: 'green',
      reason: 'no_green_meter_date',
    });
  });
});

describe('validateLogPeriod', () => {
  it('accepts the current and past months', () => {
    expect(validateLogPeriod(2026, 11, NOW).error).toBeNull();
    expect(validateLogPeriod('2001', '1', NOW).period).toEqual({
      year: 2001,
      month: 1,
    });
  });
  it.each([
    [2026, 12, 'future'],
    [2027, 1, 'future'],
    [2026, 0, 'between 1 and 12'],
    [2026, 13, 'between 1 and 12'],
    [1999, 5, '2000 or later'],
    [2026.5, 1, 'whole numbers'],
    ['abc', 1, 'whole numbers'],
    [null, 1, 'whole numbers'],
  ])('%p-%p rejected (%s)', (y, m, msg) => {
    expect(validateLogPeriod(y, m, NOW).error).toContain(msg);
  });
});

describe('normalizeSolarLog — pre_green', () => {
  const ctx = { greenMeterDate: G, period: { year: 2025, month: 3 } };

  it('stores consumption in import_* and nulls export/net', () => {
    const r = normalizeSolarLog(
      {
        meter_phase: 'pre_green',
        units_consumed_peak: '120.5',
        units_consumed_off_peak: 300,
      },
      ctx,
    );
    expect(r).toEqual({
      ok: true,
      phase: 'pre_green',
      touRequired: true,
      fields: {
        exportOffPeak: null,
        exportPeak: null,
        importOffPeak: 300,
        importPeak: 120.5,
        netOffPeak: null,
        netPeak: null,
      },
    });
  });

  it('defaults to pre_green before the green meter when phase omitted, accepts import_* aliases', () => {
    const r = normalizeSolarLog(
      { import_peak: 0, import_off_peak: '1,200' },
      ctx,
    );
    expect(r.ok && r.phase).toBe('pre_green');
    expect(r.ok && r.fields.importOffPeak).toBe(1200);
  });

  it('allows zeros (site idle) and blank/zero export fields', () => {
    const r = normalizeSolarLog(
      {
        meter_phase: 'pre_green',
        units_consumed_peak: 0,
        units_consumed_off_peak: 0,
        export_peak: '',
        net_total: 0,
      },
      ctx,
    );
    expect(r.ok).toBe(true);
  });

  it.each([
    [{ units_consumed_off_peak: 1 }, 'peak) is required'],
    [{ units_consumed_peak: 1 }, 'off-peak) is required'],
    [
      { units_consumed_peak: -1, units_consumed_off_peak: 1 },
      'cannot be negative',
    ],
    [
      { units_consumed_peak: 'x', units_consumed_off_peak: 1 },
      'must be a number',
    ],
    [
      { units_consumed_peak: true, units_consumed_off_peak: 1 },
      'must be a number',
    ],
    [
      { units_consumed_peak: MAX_MONTHLY_KWH + 1, units_consumed_off_peak: 1 },
      'too large',
    ],
    [
      { units_consumed_peak: 1, units_consumed_off_peak: 1, export_peak: 5 },
      'Nothing is exported',
    ],
    [
      { units_consumed_peak: 1, units_consumed_off_peak: 1, net_total: -3 },
      'Nothing is exported',
    ],
  ])('rejects %p', (payload, msg) => {
    const r = normalizeSolarLog({ meter_phase: 'pre_green', ...payload }, ctx);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain(msg);
  });

  it('rejects pre_green after the green meter month', () => {
    const r = normalizeSolarLog(
      {
        meter_phase: 'pre_green',
        units_consumed_peak: 1,
        units_consumed_off_peak: 1,
      },
      { greenMeterDate: G, period: { year: 2025, month: 8 } },
    );
    expect(!r.ok && r.error).toContain(
      'after the green meter was connected (Jun 2025)',
    );
  });
});

describe('normalizeSolarLog — green', () => {
  const after = { greenMeterDate: G, period: { year: 2025, month: 9 } };
  const tou = {
    tou_required: true,
    export_off_peak: 10,
    export_peak: 5,
    import_off_peak: 3,
    import_peak: 2,
    net_off_peak: 7,
    net_peak: -3,
  };

  it('TOU mode keeps all six fields; net may be negative', () => {
    const r = normalizeSolarLog(tou, after);
    expect(r.ok && r.phase).toBe('green');
    expect(r.ok && r.fields.netPeak).toBe(-3);
  });

  it('totals mode maps to *_off_peak with peak null', () => {
    const r = normalizeSolarLog(
      { tou_required: false, export_total: 10, import_total: 4, net_total: 6 },
      after,
    );
    expect(r.ok && r.touRequired).toBe(false);
    expect(r.ok && r.fields).toMatchObject({
      exportOffPeak: 10,
      exportPeak: null,
      importOffPeak: 4,
    });
  });

  it('rejects green before the green meter month', () => {
    const r = normalizeSolarLog(tou, {
      greenMeterDate: G,
      period: { year: 2025, month: 2 },
    });
    expect(!r.ok && r.error).toContain('before the green meter was connected');
  });

  it('either phase is fine in the connection month and when the date is unknown', () => {
    const june = { greenMeterDate: G, period: { year: 2025, month: 6 } };
    expect(normalizeSolarLog(tou, june).ok).toBe(true);
    expect(
      normalizeSolarLog(
        {
          meter_phase: 'pre_green',
          units_consumed_peak: 1,
          units_consumed_off_peak: 1,
        },
        june,
      ).ok,
    ).toBe(true);
    expect(
      normalizeSolarLog(tou, {
        greenMeterDate: null,
        period: { year: 2019, month: 1 },
      }).ok,
    ).toBe(true);
  });

  it.each([
    [{ ...tou, export_peak: -1 }, 'cannot be negative'],
    [{ ...tou, import_peak: '' }, 'Import (peak) is required'],
    [
      { tou_required: false, export_total: 1, import_total: 1 },
      'Net is required',
    ],
    [{ meter_phase: 'solar' }, 'meter_phase must be'],
  ])('rejects %p', (payload, msg) => {
    const r = normalizeSolarLog(payload, after);
    expect(!r.ok && r.error).toContain(msg);
  });
});

describe('phaseConflicts', () => {
  const logs = [
    { year: 2025, month: 4, phase: 'pre_green' as const },
    { year: 2025, month: 6, phase: 'pre_green' as const },
    { year: 2025, month: 7, phase: 'green' as const },
  ];
  it('none when the date fits the history', () => {
    expect(phaseConflicts('2025-06-20', logs)).toEqual([]);
    expect(phaseConflicts(null, logs)).toEqual([]);
  });
  it('moving the date earlier strands later pre_green logs', () => {
    expect(phaseConflicts('2025-05-01', logs)).toEqual([
      { year: 2025, month: 6, phase: 'pre_green' },
    ]);
  });
  it('moving the date later strands earlier green logs', () => {
    expect(phaseConflicts('2025-09-01', logs)).toEqual([
      { year: 2025, month: 7, phase: 'green' },
    ]);
  });
});
