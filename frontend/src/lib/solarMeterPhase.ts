/**
 * Frontend mirror of backend/src/domain/constants/solar-meter-phase.rules.ts.
 * Keep the two in sync — the server is authoritative and re-validates.
 *
 *  green      Net-metering log (import / export / net).
 *  pre_green  Month before the green meter was installed: units consumed
 *             peak + off-peak only; nothing exported.
 */
export type MeterPhase = "green" | "pre_green";

export const METER_PHASE_LABEL: Record<MeterPhase, string> = {
  green: "Green meter",
  pre_green: "Before green meter",
};

export const SOLAR_LOG_MIN_YEAR = 2000;
export const MAX_MONTHLY_KWH = 1_000_000;

export type YearMonth = { year: number; month: number };

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
export const formatYearMonth = (ym: YearMonth) =>
  `${MONTHS[ym.month - 1] ?? ym.month} ${ym.year}`;

const idx = (ym: YearMonth) => ym.year * 12 + (ym.month - 1);

export function pakistanYearMonth(now: Date = new Date()): YearMonth {
  const pk = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return { year: pk.getUTCFullYear(), month: pk.getUTCMonth() + 1 };
}

export function yearMonthOf(value: string | null | undefined): YearMonth | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})/.exec(value);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

export type PhaseWindow = {
  allowed: MeterPhase[];
  defaultPhase: MeterPhase;
  reason:
    | "no_green_meter_date"
    | "before_green_meter"
    | "green_meter_month"
    | "after_green_meter";
  greenMeter: YearMonth | null;
};

export function phaseWindow(
  greenMeterDate: string | null | undefined,
  period: YearMonth,
): PhaseWindow {
  const g = yearMonthOf(greenMeterDate);
  if (!g) {
    return {
      allowed: ["pre_green", "green"],
      defaultPhase: "green",
      reason: "no_green_meter_date",
      greenMeter: null,
    };
  }
  const d = idx(period) - idx(g);
  if (d < 0) {
    return { allowed: ["pre_green"], defaultPhase: "pre_green", reason: "before_green_meter", greenMeter: g };
  }
  if (d === 0) {
    return { allowed: ["pre_green", "green"], defaultPhase: "green", reason: "green_meter_month", greenMeter: g };
  }
  return { allowed: ["green"], defaultPhase: "green", reason: "after_green_meter", greenMeter: g };
}

/** One-line explanation shown under the phase selector. */
export function phaseWindowHint(w: PhaseWindow): string {
  const g = w.greenMeter ? formatYearMonth(w.greenMeter) : "";
  switch (w.reason) {
    case "before_green_meter":
      return `Green meter connected ${g} — this month is before it, so only units consumed are recorded.`;
    case "after_green_meter":
      return `Green meter connected ${g} — this month uses the green meter (import / export / net).`;
    case "green_meter_month":
      return `Green meter connected during ${g} — choose which bill this month's figures come from.`;
    default:
      return "This site has no green meter connection date. Choose the log type, and record the date on the site to lock it in.";
  }
}

/** Validate a kWh text input; returns an error message or null. */
export function kwhError(
  raw: string,
  label: string,
  opts: { allowNegative?: boolean } = {},
): string | null {
  const t = raw.trim().replace(/,/g, "");
  if (!t) return `${label} is required (0 is allowed)`;
  const n = Number(t);
  if (!Number.isFinite(n)) return `${label} must be a number`;
  if (!opts.allowNegative && n < 0) return `${label} cannot be negative`;
  if (Math.abs(n) > MAX_MONTHLY_KWH) {
    return `${label} looks too large (max ${MAX_MONTHLY_KWH.toLocaleString("en-US")} kWh)`;
  }
  return null;
}

/** Future-month guard matching the server (Pakistan calendar). */
export function isFutureMonth(period: YearMonth, now: Date = new Date()): boolean {
  return idx(period) > idx(pakistanYearMonth(now));
}

// ─── Baseline vs green-meter summary ────────────────────────────────────────

export type PhaseLogLike = {
  year: number;
  month: number;
  meter_phase?: MeterPhase | null;
  import_peak?: number | null;
  import_off_peak?: number | null;
  export_peak?: number | null;
  export_off_peak?: number | null;
};

export type PhaseSummary = {
  preGreen: {
    months: number;
    peak: number;
    offPeak: number;
    total: number;
    avgPerMonth: number | null;
    first: YearMonth | null;
    last: YearMonth | null;
  };
  green: {
    months: number;
    importTotal: number;
    exportTotal: number;
    avgImportPerMonth: number | null;
    avgExportPerMonth: number | null;
  };
  /** % change of avg monthly grid draw after the green meter vs before. */
  gridDrawChangePct: number | null;
};

const n0 = (v: number | null | undefined) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Roll monthly logs up into a before/after-green-meter comparison. */
export function summarizePhases(logs: PhaseLogLike[]): PhaseSummary {
  let pm = 0, pk = 0, op = 0;
  let gm = 0, gi = 0, ge = 0;
  let first: YearMonth | null = null;
  let last: YearMonth | null = null;
  for (const l of logs) {
    if (l.meter_phase === "pre_green") {
      pm += 1;
      pk += n0(l.import_peak);
      op += n0(l.import_off_peak);
      const ym = { year: l.year, month: l.month };
      if (!first || idx(ym) < idx(first)) first = ym;
      if (!last || idx(ym) > idx(last)) last = ym;
    } else {
      gm += 1;
      gi += n0(l.import_peak) + n0(l.import_off_peak);
      ge += n0(l.export_peak) + n0(l.export_off_peak);
    }
  }
  const preAvg = pm ? (pk + op) / pm : null;
  const gAvg = gm ? gi / gm : null;
  return {
    preGreen: { months: pm, peak: pk, offPeak: op, total: pk + op, avgPerMonth: preAvg, first, last },
    green: {
      months: gm,
      importTotal: gi,
      exportTotal: ge,
      avgImportPerMonth: gAvg,
      avgExportPerMonth: gm ? ge / gm : null,
    },
    gridDrawChangePct:
      preAvg && preAvg > 0 && gAvg !== null ? ((gAvg - preAvg) / preAvg) * 100 : null,
  };
}
