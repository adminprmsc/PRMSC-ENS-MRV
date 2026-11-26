import { cutoverImpact } from './water-cutover-impact.util';

const L = (id: string, date: string, start: string, meter: number | null) => ({
  id,
  logDate: date,
  pumpStartTime: start,
  meterReadingEnd: meter,
});

describe('cutoverImpact', () => {
  const logs = [
    L('a', '2026-01-10', '08:00', null), // hours only
    L('b', '2026-02-01', '09:00', 100), // first meter reading
    L('c', '2026-02-03', '09:00', 150),
    L('d', '2026-02-04', '09:00', null), // hours only after meter
  ];

  it('start at the first reading: nothing ignored, the later gap is flagged', () => {
    expect(cutoverImpact(logs, '2026-02-01', '09:00')).toEqual({
      cutover: '2026-02-01 09:00:00',
      ignoredMeterReadings: [],
      newlyUnmetered: 1,
    });
  });

  it('start AFTER readings → those readings would be ignored', () => {
    const r = cutoverImpact(logs, '2026-02-03', '12:00');
    expect(r.ignoredMeterReadings).toEqual([
      '2026-02-01 09:00',
      '2026-02-03 09:00',
    ]);
  });

  it('start BEFORE hours-only logs → they become unmetered', () => {
    expect(cutoverImpact(logs, '2026-01-01', null).newlyUnmetered).toBe(2);
  });

  it('clearing the start has no impact', () => {
    expect(cutoverImpact(logs, null, null)).toEqual({
      cutover: null,
      ignoredMeterReadings: [],
      newlyUnmetered: 0,
    });
  });
});
