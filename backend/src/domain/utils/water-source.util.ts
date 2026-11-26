/**
 * Water volume source selection — bulk meter vs hourly (pump-hours) estimate.
 *
 * Every water log is assigned exactly ONE source, so a pumping interval is
 * never counted twice:
 *
 *   site without bulk meter            → 'hourly'  (η × Q × pump hours)
 *   bulk site, log before cutover C    → 'hourly'  (meter fields ignored)
 *   bulk site, log at/after cutover C  → 'bulk'    (meter interval volume only;
 *                                         an hours-only log adds no volume and
 *                                         is reported as `unmetered_logs`)
 *
 * C = the site's configured bulk-meter start (date + time). When not set, it
 * falls back to the earliest submitted log that carries a meter reading.
 * Bulk flagged but no C and no meter reading yet → no bulk era (all hourly).
 *
 * Times are compared as naive Pakistan wall-clock strings
 * ("YYYY-MM-DD HH:MM:SS"), exactly how log_date + pump_start_time are stored,
 * so no time-zone conversion can shift a log across the cutover.
 */

export type WaterSource = 'bulk' | 'hourly';

/** Sortable "YYYY-MM-DD HH:MM:SS" key, or null when the date is unusable. */
export function wallClockKey(
  date: Date | string | null | undefined,
  time?: string | null,
): string | null {
  if (date == null || date === '') return null;
  let iso: string;
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) return null;
    iso = date.toISOString().slice(0, 10);
  } else {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(date.trim());
    if (!m) return null;
    iso = m[1];
  }
  return `${iso} ${normalizeTime(time)}`;
}

/** "H:MM" / "HH:MM" / "HH:MM:SS(.ms)" → "HH:MM:SS"; blank → "00:00:00". */
export function normalizeTime(time?: string | null): string {
  if (!time) return '00:00:00';
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(time).trim());
  if (!m) return '00:00:00';
  const h = m[1].padStart(2, '0');
  return `${h}:${m[2]}:${m[3] ?? '00'}`;
}

export type WaterLogLike = {
  id: string;
  logDate: Date | string | null;
  pumpStartTime?: string | null;
  pumpEndTime?: string | null;
  pumpOperatingHours?: number | null;
  meterReadingEnd?: number | null;
};

/** When the log's pumping started (falls back to pump end). */
export function logKey(log: WaterLogLike): string | null {
  return wallClockKey(log.logDate, log.pumpStartTime ?? log.pumpEndTime);
}

/**
 * Cutover key for a site, or null when the site never uses the bulk meter.
 * `earliestMeterLogKey` is the fallback (earliest submitted metered log).
 */
export function resolveCutoverKey(site: {
  bulkMeterInstalled: boolean;
  bulkMeterSinceDate?: Date | string | null;
  bulkMeterSinceTime?: string | null;
  earliestMeterLogKey?: string | null;
}): string | null {
  if (!site.bulkMeterInstalled) return null;
  const explicit = wallClockKey(
    site.bulkMeterSinceDate,
    site.bulkMeterSinceTime,
  );
  if (explicit) return explicit;
  return site.earliestMeterLogKey ?? null;
}

export function logSource(
  log: WaterLogLike,
  cutoverKey: string | null,
): WaterSource {
  if (!cutoverKey) return 'hourly';
  const k = logKey(log);
  return k !== null && k >= cutoverKey ? 'bulk' : 'hourly';
}

export type SourceBreakdown = {
  bulk: {
    /** Metered volume of bulk-era logs (m³). */
    m3: number;
    hours: number;
    days: number;
    logs: number;
    /** Bulk-era logs without a meter reading (no volume counted). */
    unmeteredLogs: number;
  };
  hourly: {
    /** η × Q × hours for pre-cutover / non-bulk logs; null if η or Q unknown. */
    m3: number | null;
    hours: number;
    days: number;
    logs: number;
  };
  /** Distinct days across both sources (a cutover day counts once). */
  days: number;
  hours: number;
  logs: number;
};

/**
 * Split one site's in-range logs by source and total each side.
 * `intervalVolumes` = metered volume per log id (from the full meter chain).
 */
export function summarizeBySource(
  logs: WaterLogLike[],
  opts: {
    cutoverKey: string | null;
    intervalVolumes: Record<string, number>;
    efficiency: number | null;
    flowRate: number | null;
  },
): SourceBreakdown {
  const bulkDays = new Set<string>();
  const hourlyDays = new Set<string>();
  const allDays = new Set<string>();
  let bM3 = 0,
    bH = 0,
    bL = 0,
    bUnmetered = 0;
  let hH = 0,
    hL = 0;
  for (const log of logs) {
    const day = wallClockKey(log.logDate)?.slice(0, 10);
    if (!day) continue;
    const hours = Number(log.pumpOperatingHours ?? 0) || 0;
    allDays.add(day);
    if (logSource(log, opts.cutoverKey) === 'bulk') {
      bL += 1;
      bH += hours;
      bulkDays.add(day);
      const v = opts.intervalVolumes[String(log.id)];
      if (log.meterReadingEnd == null || v == null) {
        if (log.meterReadingEnd == null) bUnmetered += 1;
      } else {
        bM3 += v;
      }
    } else {
      hL += 1;
      hH += hours;
      hourlyDays.add(day);
    }
  }
  const est =
    opts.efficiency != null && opts.flowRate != null
      ? opts.efficiency * opts.flowRate * hH
      : null;
  return {
    bulk: {
      m3: bM3,
      hours: bH,
      days: bulkDays.size,
      logs: bL,
      unmeteredLogs: bUnmetered,
    },
    hourly: {
      m3: hL > 0 ? est : 0,
      hours: hH,
      days: hourlyDays.size,
      logs: hL,
    },
    days: allDays.size,
    hours: bH + hH,
    logs: bL + hL,
  };
}
