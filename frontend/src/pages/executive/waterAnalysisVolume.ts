import type { WaterSystemDetailRow } from "./executiveAnalysisTypes";

export function waterVolumeBasisLabel(
  row: WaterSystemDetailRow,
): "Bulk meter" | "Estimated (OHR)" {
  if (row.volume_basis === "estimated" || !row.bulk_meter_installed) {
    return "Estimated (OHR)";
  }
  return "Bulk meter";
}

export function calculatedTotalM3(row: WaterSystemDetailRow): number | null {
  if (row.calculated_total_m3 != null && Number.isFinite(row.calculated_total_m3)) {
    return row.calculated_total_m3;
  }
  if (row.bulk_meter_installed) {
    const w = row.total_water_pumped_m3;
    return w != null && Number.isFinite(w) ? w : null;
  }
  const e = row.estimated_water_m3;
  return e != null && Number.isFinite(e) ? e : null;
}

export function calculatedAvgDailyM3(row: WaterSystemDetailRow): number | null {
  if (
    row.calculated_avg_daily_m3 != null &&
    Number.isFinite(row.calculated_avg_daily_m3)
  ) {
    return row.calculated_avg_daily_m3;
  }
  if (row.bulk_meter_installed && row.avg_m3_per_day_logged != null) {
    return row.avg_m3_per_day_logged;
  }
  const total = calculatedTotalM3(row);
  const days = row.days_logged;
  if (total == null || !days) return null;
  return total / days;
}

export function calculatedAvgHourlyM3(row: WaterSystemDetailRow): number | null {
  if (
    row.calculated_avg_hourly_m3 != null &&
    Number.isFinite(row.calculated_avg_hourly_m3)
  ) {
    return row.calculated_avg_hourly_m3;
  }
  if (row.bulk_meter_installed && row.avg_m3_per_hour != null) {
    return row.avg_m3_per_hour;
  }
  const total = calculatedTotalM3(row);
  const hours = row.total_pump_hours_h;
  if (total == null || !hours) return null;
  return total / hours;
}

/** OHR / no bulk meter — η × flow × runtime (period total). */
export function estimatedTotalM3(row: WaterSystemDetailRow): number | null {
  if (row.bulk_meter_installed) return null;
  const e = row.estimated_water_m3 ?? row.calculated_total_m3;
  return e != null && Number.isFinite(Number(e)) ? Number(e) : null;
}

export function estimatedAvgDailyM3(row: WaterSystemDetailRow): number | null {
  if (row.bulk_meter_installed) return null;
  if (
    row.calculated_avg_daily_m3 != null &&
    Number.isFinite(row.calculated_avg_daily_m3)
  ) {
    return row.calculated_avg_daily_m3;
  }
  const total = estimatedTotalM3(row);
  const days = row.days_logged;
  if (total == null || !days) return null;
  return total / days;
}

export function estimatedAvgHourlyM3(row: WaterSystemDetailRow): number | null {
  if (row.bulk_meter_installed) return null;
  if (
    row.calculated_avg_hourly_m3 != null &&
    Number.isFinite(row.calculated_avg_hourly_m3)
  ) {
    return row.calculated_avg_hourly_m3;
  }
  const total = estimatedTotalM3(row);
  const hours = row.total_pump_hours_h;
  if (total == null || !hours) return null;
  return total / hours;
}

/** Bulk meter — sum of interval volumes in period. */
export function meterTotalM3(row: WaterSystemDetailRow): number | null {
  if (!row.bulk_meter_installed) return null;
  const w = row.total_water_pumped_m3;
  return w != null && Number.isFinite(Number(w)) ? Number(w) : null;
}

export function meterAvgDailyM3(row: WaterSystemDetailRow): number | null {
  if (!row.bulk_meter_installed) return null;
  if (row.avg_m3_per_day_logged != null && Number.isFinite(row.avg_m3_per_day_logged)) {
    return row.avg_m3_per_day_logged;
  }
  const total = meterTotalM3(row);
  const days = row.days_logged;
  if (total == null || !days) return null;
  return total / days;
}

export function meterAvgHourlyM3(row: WaterSystemDetailRow): number | null {
  if (!row.bulk_meter_installed) return null;
  if (row.avg_m3_per_hour != null && Number.isFinite(row.avg_m3_per_hour)) {
    return row.avg_m3_per_hour;
  }
  const total = meterTotalM3(row);
  const hours = row.total_pump_hours_h;
  if (total == null || !hours) return null;
  return total / hours;
}
