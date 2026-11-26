import {
  logSource,
  normalizeTime,
  resolveCutoverKey,
  summarizeBySource,
  wallClockKey,
  type WaterLogLike,
} from './water-source.util';

const log = (
  id: string,
  date: string,
  start: string | null,
  hours: number,
  meterEnd: number | null = null,
): WaterLogLike => ({
  id,
  logDate: new Date(`${date}T00:00:00.000Z`),
  pumpStartTime: start,
  pumpEndTime: null,
  pumpOperatingHours: hours,
  meterReadingEnd: meterEnd,
});

describe('wallClockKey / normalizeTime', () => {
  it.each([
    ['8:05', '08:05:00'],
    ['08:05:30', '08:05:30'],
    ['08:05:30.000', '08:05:30'],
    [null, '00:00:00'],
    ['junk', '00:00:00'],
  ])('%p → %p', (t, out) => expect(normalizeTime(t)).toBe(out));

  it('builds sortable keys from Date or string, ignoring time zones', () => {
    expect(wallClockKey(new Date('2026-03-15T00:00:00Z'), '06:30')).toBe(
      '2026-03-15 06:30:00',
    );
    expect(wallClockKey('2026-03-15', null)).toBe('2026-03-15 00:00:00');
    expect(wallClockKey(null)).toBeNull();
    expect(wallClockKey('15/03/2026')).toBeNull();
  });
});

describe('resolveCutoverKey', () => {
  it('no bulk meter → never bulk', () => {
    expect(
      resolveCutoverKey({
        bulkMeterInstalled: false,
        bulkMeterSinceDate: '2026-01-01',
      }),
    ).toBeNull();
  });
  it('explicit start wins over the earliest meter log', () => {
    expect(
      resolveCutoverKey({
        bulkMeterInstalled: true,
        bulkMeterSinceDate: '2026-03-15',
        bulkMeterSinceTime: '10:00',
        earliestMeterLogKey: '2026-02-01 08:00:00',
      }),
    ).toBe('2026-03-15 10:00:00');
  });
  it('falls back to the earliest meter log, else no bulk era', () => {
    expect(
      resolveCutoverKey({
        bulkMeterInstalled: true,
        earliestMeterLogKey: '2026-02-01 08:00:00',
      }),
    ).toBe('2026-02-01 08:00:00');
    expect(resolveCutoverKey({ bulkMeterInstalled: true })).toBeNull();
  });
});

describe('logSource', () => {
  const C = '2026-03-15 10:00:00';
  it('splits the cutover day at the configured time', () => {
    expect(logSource(log('a', '2026-03-15', '09:59', 1), C)).toBe('hourly');
    expect(logSource(log('b', '2026-03-15', '10:00', 1), C)).toBe('bulk');
    expect(logSource(log('c', '2026-03-14', '23:00', 1), C)).toBe('hourly');
    expect(logSource(log('d', '2026-03-16', '00:00', 1), C)).toBe('bulk');
  });
  it('uses pump end when start is missing', () => {
    expect(
      logSource({ id: 'e', logDate: '2026-03-15', pumpEndTime: '11:00' }, C),
    ).toBe('bulk');
  });
  it('no cutover → hourly', () => {
    expect(logSource(log('f', '2030-01-01', '00:00', 1, 99), null)).toBe(
      'hourly',
    );
  });
});

describe('summarizeBySource', () => {
  const C = '2026-03-15 10:00:00';
  const logs = [
    log('h1', '2026-03-14', '08:00', 4), // hourly
    log('h2', '2026-03-15', '06:00', 2), // hourly (before 10:00 on cutover day)
    log('h3', '2026-03-10', '06:00', 3, 500), // pre-cutover WITH meter → still hourly, meter ignored
    log('b1', '2026-03-15', '12:00', 5, 1100), // bulk
    log('b2', '2026-03-16', '07:00', 6, 1250), // bulk
    log('b3', '2026-03-16', '15:00', 1), // bulk era but no reading → unmetered
  ];
  const vols = { h3: 40, b1: 100, b2: 150 };

  it('each log counts once; meter only after cutover, estimate only before', () => {
    const s = summarizeBySource(logs, {
      cutoverKey: C,
      intervalVolumes: vols,
      efficiency: 0.5,
      flowRate: 10,
    });
    expect(s.bulk).toEqual({
      m3: 250,
      hours: 12,
      days: 2,
      logs: 3,
      unmeteredLogs: 1,
    });
    // hourly: 4 + 2 + 3 = 9 h → 0.5 × 10 × 9 = 45 m³ (h3's 40 m³ meter volume NOT added)
    expect(s.hourly).toEqual({ m3: 45, hours: 9, days: 3, logs: 3 });
    // 2026-03-15 is in both sides but counts once overall.
    expect(s.days).toBe(4);
    expect(s.hours).toBe(21);
    expect(s.logs).toBe(6);
  });

  it('non-bulk site: everything is hourly', () => {
    const s = summarizeBySource(logs, {
      cutoverKey: null,
      intervalVolumes: vols,
      efficiency: 0.5,
      flowRate: 10,
    });
    expect(s.bulk.logs).toBe(0);
    expect(s.hourly.hours).toBe(21);
    expect(s.hourly.m3).toBe(105);
  });

  it('estimate is null when η or Q unknown, 0 when no hourly logs', () => {
    expect(
      summarizeBySource(logs, {
        cutoverKey: C,
        intervalVolumes: vols,
        efficiency: null,
        flowRate: 10,
      }).hourly.m3,
    ).toBeNull();
    const onlyBulk = logs.filter((l) => l.id.startsWith('b'));
    expect(
      summarizeBySource(onlyBulk, {
        cutoverKey: C,
        intervalVolumes: vols,
        efficiency: null,
        flowRate: null,
      }).hourly.m3,
    ).toBe(0);
  });
});
