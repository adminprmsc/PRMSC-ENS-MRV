/**
 * Solar monthly logs — meter phase rules.
 *
 *  green      Normal net-metering log (green meter installed): import, export
 *             and net, either peak/off-peak (TOU) or single totals.
 *  pre_green  Back-dated log for a month BEFORE the green meter was installed.
 *             Nothing could be exported, so only "units consumed" peak and
 *             off-peak are taken (stored in import_peak / import_off_peak);
 *             export_* and net_* are stored as NULL.
 *
 * Which phase a month may use is decided by the site's green meter
 * connection date (G):
 *   month <  month(G)  → pre_green only
 *   month == month(G)  → either (the bill straddles the switch-over)
 *   month >  month(G)  → green only
 *   G unknown          → either (legacy sites); UI asks to record G.
 *
 * Every rule here is pure so it is unit-tested and mirrored on the frontend
 * (frontend/src/lib/solarMeterPhase.ts).
 */

export const METER_PHASE_GREEN = 'green';
export const METER_PHASE_PRE_GREEN = 'pre_green';
export type MeterPhase =
  typeof METER_PHASE_GREEN | typeof METER_PHASE_PRE_GREEN;
export const METER_PHASES: readonly MeterPhase[] = [
  METER_PHASE_GREEN,
  METER_PHASE_PRE_GREEN,
];

export const SOLAR_LOG_MIN_YEAR = 2000;
/** Sanity ceiling for a single month's kWh (any field). */
export const MAX_MONTHLY_KWH = 1_000_000;

export type YearMonth = { year: number; month: number };

/** Current calendar month in Pakistan (Asia/Karachi, UTC+5, no DST). */
export function pakistanYearMonth(now: Date = new Date()): YearMonth {
  const pk = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return { year: pk.getUTCFullYear(), month: pk.getUTCMonth() + 1 };
}

const ymIndex = (ym: YearMonth) => ym.year * 12 + (ym.month - 1);

/** Calendar month of a `date` value (UTC midnight or YYYY-MM-DD string). */
export function yearMonthOf(
  value: Date | string | null | undefined,
): YearMonth | null {
  if (value == null || value === '') return null;
  const d =
    value instanceof Date
      ? value
      : /^\d{4}-\d{2}-\d{2}/.test(value)
        ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
        : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export type PhaseWindowReason =
  | 'no_green_meter_date'
  | 'before_green_meter'
  | 'green_meter_month'
  | 'after_green_meter';

export type PhaseWindow = {
  allowed: MeterPhase[];
  /** Used when the client does not send `meter_phase`. */
  defaultPhase: MeterPhase;
  reason: PhaseWindowReason;
};

export function phaseWindow(
  greenMeterDate: Date | string | null | undefined,
  period: YearMonth,
): PhaseWindow {
  const g = yearMonthOf(greenMeterDate);
  if (!g) {
    return {
      allowed: [METER_PHASE_PRE_GREEN, METER_PHASE_GREEN],
      defaultPhase: METER_PHASE_GREEN,
      reason: 'no_green_meter_date',
    };
  }
  const diff = ymIndex(period) - ymIndex(g);
  if (diff < 0) {
    return {
      allowed: [METER_PHASE_PRE_GREEN],
      defaultPhase: METER_PHASE_PRE_GREEN,
      reason: 'before_green_meter',
    };
  }
  if (diff === 0) {
    return {
      allowed: [METER_PHASE_PRE_GREEN, METER_PHASE_GREEN],
      defaultPhase: METER_PHASE_GREEN,
      reason: 'green_meter_month',
    };
  }
  return {
    allowed: [METER_PHASE_GREEN],
    defaultPhase: METER_PHASE_GREEN,
    reason: 'after_green_meter',
  };
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
export const formatYearMonth = (ym: YearMonth) =>
  `${MONTH_NAMES[ym.month - 1] ?? ym.month} ${ym.year}`;

/** Validate the log period; returns an error message or null. */
export function validateLogPeriod(
  year: unknown,
  month: unknown,
  now: Date = new Date(),
): { period: YearMonth | null; error: string | null } {
  const num = (v: unknown) =>
    typeof v === 'number'
      ? v
      : typeof v === 'string' && v.trim() !== ''
        ? Number(v.trim())
        : NaN;
  const y = num(year);
  const m = num(month);
  if (!Number.isInteger(y) || !Number.isInteger(m)) {
    return { period: null, error: 'Year and month must be whole numbers' };
  }
  if (m < 1 || m > 12) {
    return { period: null, error: 'Month must be between 1 and 12' };
  }
  if (y < SOLAR_LOG_MIN_YEAR) {
    return {
      period: null,
      error: `Year must be ${SOLAR_LOG_MIN_YEAR} or later`,
    };
  }
  const period = { year: y, month: m };
  const current = pakistanYearMonth(now);
  if (ymIndex(period) > ymIndex(current)) {
    return {
      period: null,
      error: `${formatYearMonth(period)} is in the future — logs can be entered up to ${formatYearMonth(current)}`,
    };
  }
  return { period, error: null };
}

type NumberCheck = { allowNegative?: boolean };

/** Parse one kWh field. `undefined` = blank. Throws a readable message. */
function kwh(
  raw: unknown,
  label: string,
  opts: NumberCheck = {},
): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'string' && raw.trim() === '') return undefined;
  if (
    typeof raw === 'boolean' ||
    (typeof raw !== 'number' && typeof raw !== 'string')
  ) {
    throw new Error(`${label} must be a number`);
  }
  const n =
    typeof raw === 'number' ? raw : Number(raw.trim().replace(/,/g, ''));
  if (!Number.isFinite(n)) throw new Error(`${label} must be a number`);
  if (!opts.allowNegative && n < 0)
    throw new Error(`${label} cannot be negative`);
  if (Math.abs(n) > MAX_MONTHLY_KWH) {
    throw new Error(
      `${label} looks too large (max ${MAX_MONTHLY_KWH.toLocaleString('en-US')} kWh per month)`,
    );
  }
  return n;
}

function required(v: number | undefined, label: string): number {
  if (v === undefined) throw new Error(`${label} is required (0 is allowed)`);
  return v;
}

function truthy(raw: unknown): boolean | null {
  if (
    raw === true ||
    raw === 'true' ||
    raw === 1 ||
    raw === '1' ||
    raw === 'yes'
  )
    return true;
  if (
    raw === false ||
    raw === 'false' ||
    raw === 0 ||
    raw === '0' ||
    raw === 'no'
  )
    return false;
  return null;
}

export type SolarLogFields = {
  exportOffPeak: number | null;
  exportPeak: number | null;
  importOffPeak: number | null;
  importPeak: number | null;
  netOffPeak: number | null;
  netPeak: number | null;
};

export type NormalizedSolarLog =
  | {
      ok: true;
      phase: MeterPhase;
      touRequired: boolean;
      fields: SolarLogFields;
    }
  | { ok: false; error: string };

/**
 * Validate + normalise a monthly log payload for a given site/period.
 *
 * Accepted payload keys:
 *  meter_phase: 'green' | 'pre_green' (optional → window default)
 *  pre_green:   units_consumed_peak / units_consumed_off_peak
 *               (aliases: import_peak / import_off_peak)
 *  green TOU:   export_/import_/net_ (off_peak, peak); tou_required: true
 *  green total: export_total / import_total / net_total; tou_required: false
 */
export function normalizeSolarLog(
  payload: Record<string, unknown>,
  ctx: { greenMeterDate: Date | string | null | undefined; period: YearMonth },
): NormalizedSolarLog {
  const window = phaseWindow(ctx.greenMeterDate, ctx.period);
  const rawPhase = payload.meter_phase;
  let phase: MeterPhase;
  if (rawPhase === undefined || rawPhase === null || rawPhase === '') {
    // Legacy clients don't send a phase: infer it from the fields present so
    // a green-shaped payload for a pre-green month gets the right message.
    const has = (k: string) =>
      payload[k] !== undefined && payload[k] !== null && payload[k] !== '';
    const greenShaped = [
      'export_peak',
      'export_off_peak',
      'export_total',
      'net_peak',
      'net_off_peak',
      'net_total',
      'import_total',
    ].some(has);
    const preGreenShaped = [
      'units_consumed_peak',
      'units_consumed_off_peak',
    ].some(has);
    phase = greenShaped
      ? METER_PHASE_GREEN
      : preGreenShaped
        ? METER_PHASE_PRE_GREEN
        : window.defaultPhase;
  } else if (
    rawPhase === METER_PHASE_GREEN ||
    rawPhase === METER_PHASE_PRE_GREEN
  ) {
    phase = rawPhase;
  } else {
    return { ok: false, error: 'meter_phase must be "green" or "pre_green"' };
  }

  if (!window.allowed.includes(phase)) {
    const g = yearMonthOf(ctx.greenMeterDate);
    const when = g ? formatYearMonth(g) : '';
    return {
      ok: false,
      error:
        phase === METER_PHASE_PRE_GREEN
          ? `${formatYearMonth(ctx.period)} is after the green meter was connected (${when}) — use a green meter log (import / export / net)`
          : `${formatYearMonth(ctx.period)} is before the green meter was connected (${when}) — only "before green meter" logs (units consumed peak / off-peak) are allowed`,
    };
  }

  try {
    if (phase === METER_PHASE_PRE_GREEN) {
      const peak = required(
        kwh(
          payload.units_consumed_peak ?? payload.import_peak,
          'Units consumed (peak)',
        ),
        'Units consumed (peak)',
      );
      const offPeak = required(
        kwh(
          payload.units_consumed_off_peak ?? payload.import_off_peak,
          'Units consumed (off-peak)',
        ),
        'Units consumed (off-peak)',
      );
      for (const k of [
        'export_peak',
        'export_off_peak',
        'export_total',
        'net_peak',
        'net_off_peak',
        'net_total',
      ]) {
        const v = kwh(payload[k], k, { allowNegative: true });
        if (v !== undefined && v !== 0) {
          throw new Error(
            'Nothing is exported before the green meter — leave export and net empty',
          );
        }
      }
      return {
        ok: true,
        phase,
        touRequired: true,
        fields: {
          exportOffPeak: null,
          exportPeak: null,
          importOffPeak: offPeak,
          importPeak: peak,
          netOffPeak: null,
          netPeak: null,
        },
      };
    }

    const explicitTou = truthy(payload.tou_required);
    const tou =
      explicitTou ??
      ['export_peak', 'import_peak', 'net_peak'].some(
        (k) =>
          payload[k] !== null && payload[k] !== undefined && payload[k] !== '',
      );
    if (tou) {
      return {
        ok: true,
        phase,
        touRequired: true,
        fields: {
          exportOffPeak: required(
            kwh(payload.export_off_peak, 'Export (off-peak)'),
            'Export (off-peak)',
          ),
          exportPeak: required(
            kwh(payload.export_peak, 'Export (peak)'),
            'Export (peak)',
          ),
          importOffPeak: required(
            kwh(payload.import_off_peak, 'Import (off-peak)'),
            'Import (off-peak)',
          ),
          importPeak: required(
            kwh(payload.import_peak, 'Import (peak)'),
            'Import (peak)',
          ),
          netOffPeak: required(
            kwh(payload.net_off_peak, 'Net (off-peak)', {
              allowNegative: true,
            }),
            'Net (off-peak)',
          ),
          netPeak: required(
            kwh(payload.net_peak, 'Net (peak)', { allowNegative: true }),
            'Net (peak)',
          ),
        },
      };
    }
    return {
      ok: true,
      phase,
      touRequired: false,
      fields: {
        exportOffPeak: required(kwh(payload.export_total, 'Export'), 'Export'),
        exportPeak: null,
        importOffPeak: required(kwh(payload.import_total, 'Import'), 'Import'),
        importPeak: null,
        netOffPeak: required(
          kwh(payload.net_total, 'Net', { allowNegative: true }),
          'Net',
        ),
        netPeak: null,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Logs that would break the rules if the site's green meter date became
 * `greenMeterDate`. Used to refuse a date change that contradicts history.
 */
export function phaseConflicts(
  greenMeterDate: Date | string | null | undefined,
  logs: Array<YearMonth & { phase: MeterPhase }>,
): Array<YearMonth & { phase: MeterPhase }> {
  return logs
    .filter((l) => !phaseWindow(greenMeterDate, l).allowed.includes(l.phase))
    .sort((a, b) => ymIndex(a) - ymIndex(b));
}
