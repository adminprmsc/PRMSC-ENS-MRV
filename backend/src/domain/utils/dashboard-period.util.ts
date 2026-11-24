import { BadRequestException } from '@nestjs/common';

/** Calendar month bucket used by range-mode trend series. */
export type MonthBucket = { year: number; month: number };

/**
 * Normalised reporting period for dashboard queries.
 *
 * Precedence: an explicit `date_from` / `date_to` range wins over `year` /
 * `month`. Water logs are daily, so they use exact day bounds
 * (`start` inclusive, `endExclusive` exclusive). Solar logs are monthly, so
 * they use year-month keys (`year * 100 + month`, both bounds inclusive):
 * any month that overlaps the range is included in full.
 */
export type DashboardPeriod = {
  /** True when the caller supplied a custom date range. */
  isRange: boolean;
  /** Inclusive YYYY-MM-DD lower bound for daily logs (null = unbounded). */
  start: string | null;
  /** Exclusive YYYY-MM-DD upper bound for daily logs (null = unbounded). */
  endExclusive: string | null;
  /** Inclusive lower bound for monthly logs as `year * 100 + month`. */
  ymStart: number | null;
  /** Inclusive upper bound for monthly logs as `year * 100 + month`. */
  ymEnd: number | null;
  /** Legacy filters, echoed back in `meta` and used by year/month modes. */
  year?: number;
  month?: number;
  /** Inclusive range as supplied (range mode only). */
  dateFrom?: string;
  dateTo?: string;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse a strict YYYY-MM-DD calendar date; returns null when invalid. */
export function parseIsoDate(
  raw: string | undefined | null,
): { year: number; month: number; day: number } | null {
  const m = ISO_DATE.exec(String(raw ?? '').trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function nextDayIso(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month - 1, day + 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function resolveDashboardPeriod(input: {
  year?: number;
  month?: number;
  dateFrom?: string;
  dateTo?: string;
}): DashboardPeriod {
  const rawFrom = input.dateFrom?.trim() || '';
  const rawTo = input.dateTo?.trim() || '';

  if (rawFrom || rawTo) {
    const from = parseIsoDate(rawFrom);
    const to = parseIsoDate(rawTo);
    if (!from || !to) {
      throw new BadRequestException(
        'date_from and date_to must both be valid YYYY-MM-DD dates',
      );
    }
    if (rawFrom > rawTo) {
      throw new BadRequestException('date_from must be on or before date_to');
    }
    return {
      isRange: true,
      start: rawFrom,
      endExclusive: nextDayIso(to.year, to.month, to.day),
      ymStart: from.year * 100 + from.month,
      ymEnd: to.year * 100 + to.month,
      dateFrom: rawFrom,
      dateTo: rawTo,
    };
  }

  const { year, month } = input;
  if (year && month) {
    return {
      isRange: false,
      start: `${year}-${pad2(month)}-01`,
      endExclusive:
        month === 12 ? `${year + 1}-01-01` : `${year}-${pad2(month + 1)}-01`,
      ymStart: year * 100 + month,
      ymEnd: year * 100 + month,
      year,
      month,
    };
  }
  if (year) {
    return {
      isRange: false,
      start: `${year}-01-01`,
      endExclusive: `${year + 1}-01-01`,
      ymStart: year * 100 + 1,
      ymEnd: year * 100 + 12,
      year,
    };
  }
  // Month without year (every year's Nth month) or no period at all.
  return {
    isRange: false,
    start: null,
    endExclusive: null,
    ymStart: null,
    ymEnd: null,
    ...(month ? { month } : {}),
  };
}

/** Every calendar month touched by the range, oldest first. */
export function monthBucketsForPeriod(period: DashboardPeriod): MonthBucket[] {
  if (period.ymStart == null || period.ymEnd == null) return [];
  const buckets: MonthBucket[] = [];
  let y = Math.floor(period.ymStart / 100);
  let m = period.ymStart % 100;
  const endY = Math.floor(period.ymEnd / 100);
  const endM = period.ymEnd % 100;
  while (y < endY || (y === endY && m <= endM)) {
    buckets.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return buckets;
}

/** `meta` payload echoed by detail endpoints. */
export function periodMeta(period: DashboardPeriod) {
  return {
    month: period.month,
    year: period.year,
    ...(period.isRange
      ? { date_from: period.dateFrom, date_to: period.dateTo }
      : {}),
  };
}
