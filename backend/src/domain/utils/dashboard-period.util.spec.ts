import { BadRequestException } from '@nestjs/common';
import {
  monthBucketsForPeriod,
  parseIsoDate,
  resolveDashboardPeriod,
} from './dashboard-period.util';

describe('resolveDashboardPeriod', () => {
  it('uses an inclusive custom range with exclusive next-day end', () => {
    const p = resolveDashboardPeriod({
      dateFrom: '2026-01-01',
      dateTo: '2026-10-31',
    });
    expect(p.isRange).toBe(true);
    expect(p.start).toBe('2026-01-01');
    expect(p.endExclusive).toBe('2026-11-01');
    expect(p.ymStart).toBe(202601);
    expect(p.ymEnd).toBe(202610);
  });

  it('range wins over year/month', () => {
    const p = resolveDashboardPeriod({
      year: 2025,
      month: 3,
      dateFrom: '2026-02-10',
      dateTo: '2026-02-10',
    });
    expect(p.start).toBe('2026-02-10');
    expect(p.endExclusive).toBe('2026-02-11');
    expect(p.year).toBeUndefined();
  });

  it('rolls the end over a year boundary', () => {
    const p = resolveDashboardPeriod({
      dateFrom: '2025-11-15',
      dateTo: '2025-12-31',
    });
    expect(p.endExclusive).toBe('2026-01-01');
  });

  it('rejects partial, malformed and inverted ranges', () => {
    expect(() => resolveDashboardPeriod({ dateFrom: '2026-01-01' })).toThrow(
      BadRequestException,
    );
    expect(() =>
      resolveDashboardPeriod({ dateFrom: '2026-02-30', dateTo: '2026-03-01' }),
    ).toThrow(BadRequestException);
    expect(() =>
      resolveDashboardPeriod({ dateFrom: '2026-05-01', dateTo: '2026-04-01' }),
    ).toThrow(BadRequestException);
  });

  it('keeps legacy year and year+month bounds', () => {
    expect(resolveDashboardPeriod({ year: 2026 })).toMatchObject({
      isRange: false,
      start: '2026-01-01',
      endExclusive: '2027-01-01',
      ymStart: 202601,
      ymEnd: 202612,
    });
    expect(resolveDashboardPeriod({ year: 2026, month: 12 })).toMatchObject({
      start: '2026-12-01',
      endExclusive: '2027-01-01',
      ymStart: 202612,
      ymEnd: 202612,
    });
  });

  it('is unbounded with no period', () => {
    expect(resolveDashboardPeriod({})).toMatchObject({
      start: null,
      endExclusive: null,
      ymStart: null,
    });
  });
});

describe('monthBucketsForPeriod', () => {
  it('lists every month touched by a cross-year range', () => {
    const p = resolveDashboardPeriod({
      dateFrom: '2025-11-20',
      dateTo: '2026-02-03',
    });
    expect(monthBucketsForPeriod(p)).toEqual([
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ]);
  });
});

describe('parseIsoDate', () => {
  it('validates real calendar dates', () => {
    expect(parseIsoDate('2028-02-29')).toEqual({
      year: 2028,
      month: 2,
      day: 29,
    });
    expect(parseIsoDate('2026-02-29')).toBeNull();
    expect(parseIsoDate('2026-1-01')).toBeNull();
  });
});
