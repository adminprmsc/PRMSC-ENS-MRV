import type { WaterSystemDetailRow } from "./executiveAnalysisTypes";

/**
 * Water volumes per source. The API assigns every log to exactly one source:
 * bulk meter (at/after the site's bulk cutover) or hourly estimate (before it,
 * or always when there is no bulk meter). Helpers read the per-source values
 * the API returns — never the `bulk_meter_installed` flag alone, which says
 * nothing about which dates were metered.
 */

const num = (v: unknown): number | null => {
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
};

export type WaterSourceFilter = "all" | "bulk" | "hourly";

export function hasMeterData(row: WaterSystemDetailRow): boolean {
  return Number(row.bulk_logs_count ?? 0) > 0 || num(row.total_water_pumped_m3) != null;
}

export function hasHourlyData(row: WaterSystemDetailRow): boolean {
  return Number(row.hourly_logs_count ?? 0) > 0 || num(row.estimated_water_m3) != null;
}

export function waterVolumeBasisLabel(
  row: WaterSystemDetailRow,
): "Bulk meter" | "Estimated (pump hours)" | "Mixed" {
  if (row.volume_basis === "mixed") return "Mixed";
  if (row.volume_basis === "bulk_meter") return "Bulk meter";
  if (row.volume_basis === "estimated") return "Estimated (pump hours)";
  return hasMeterData(row) ? "Bulk meter" : "Estimated (pump hours)";
}

/** Every source combined (meter era + estimate era). */
export function calculatedTotalM3(row: WaterSystemDetailRow): number | null {
  const c = num(row.calculated_total_m3);
  if (c != null) return c;
  const m = meterTotalM3(row);
  const e = estimatedTotalM3(row);
  return m == null && e == null ? null : (m ?? 0) + (e ?? 0);
}

export function calculatedAvgDailyM3(row: WaterSystemDetailRow): number | null {
  const c = num(row.calculated_avg_daily_m3);
  if (c != null) return c;
  const t = calculatedTotalM3(row);
  return t != null && row.days_logged ? t / row.days_logged : null;
}

export function calculatedAvgHourlyM3(row: WaterSystemDetailRow): number | null {
  const c = num(row.calculated_avg_hourly_m3);
  if (c != null) return c;
  const t = calculatedTotalM3(row);
  return t != null && row.total_pump_hours_h ? t / row.total_pump_hours_h : null;
}

/** Hourly estimate (η × flow × runtime) for the estimate-era logs only. */
export function estimatedTotalM3(row: WaterSystemDetailRow): number | null {
  return num(row.estimated_water_m3);
}

export function estimatedAvgDailyM3(row: WaterSystemDetailRow): number | null {
  const a = num(row.estimated_avg_daily_m3);
  if (a != null) return a;
  const t = estimatedTotalM3(row);
  const d = Number(row.hourly_days_logged ?? 0);
  return t != null && d > 0 ? t / d : null;
}

export function estimatedAvgHourlyM3(row: WaterSystemDetailRow): number | null {
  const a = num(row.estimated_avg_hourly_m3);
  if (a != null) return a;
  const t = estimatedTotalM3(row);
  const h = Number(row.hourly_pump_hours_h ?? 0);
  return t != null && h > 0 ? t / h : null;
}

/** Bulk meter — sum of metered interval volumes in the meter era. */
export function meterTotalM3(row: WaterSystemDetailRow): number | null {
  return num(row.total_water_pumped_m3);
}

export function meterAvgDailyM3(row: WaterSystemDetailRow): number | null {
  const a = num(row.avg_m3_per_day_logged);
  if (a != null) return a;
  const t = meterTotalM3(row);
  const d = Number(row.bulk_days_logged ?? 0);
  return t != null && d > 0 ? t / d : null;
}

export function meterAvgHourlyM3(row: WaterSystemDetailRow): number | null {
  const a = num(row.avg_m3_per_hour);
  if (a != null) return a;
  const t = meterTotalM3(row);
  const h = Number(row.bulk_pump_hours_h ?? 0);
  return t != null && h > 0 ? t / h : null;
}
