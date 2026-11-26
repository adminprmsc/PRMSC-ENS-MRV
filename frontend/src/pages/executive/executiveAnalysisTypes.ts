export type ExecutiveScopeFilters = {
  tehsil: string;
  village: string;
  settlement: string;
  month: string;
  year: string;
  /** Inclusive YYYY-MM-DD custom range; overrides year/month when both set. */
  dateFrom: string;
  dateTo: string;
};

export type WaterSystemDetailRow = {
  water_system_id: string;
  unique_identifier?: string | null;
  tehsil: string;
  village: string;
  settlement?: string | null;
  /** Site start of operation, YYYY-MM-DD. */
  start_of_operation?: string | null;
  bulk_meter_installed: boolean;
  /**
   * `bulk_meter` = all logs metered; `estimated` = all logs η × Q × runtime;
   * `mixed` = estimate before the bulk cutover, meter from it onward.
   */
  volume_basis?: "bulk_meter" | "estimated" | "mixed" | null;
  /** "YYYY-MM-DD HH:MM" from which only meter readings count (null = never). */
  bulk_meter_since?: string | null;
  bulk_meter_since_source?: "configured" | "first_meter_reading" | null;
  /** Meter era (at/after cutover). */
  bulk_pump_hours_h?: number;
  bulk_days_logged?: number;
  bulk_logs_count?: number;
  /** Meter-era logs without a reading — no volume counted. */
  unmetered_bulk_logs?: number;
  /** Hourly era (before cutover, or no bulk meter). */
  hourly_pump_hours_h?: number;
  hourly_days_logged?: number;
  hourly_logs_count?: number;
  /** Estimate-era logs exist but η or flow rate is missing on the site. */
  estimate_inputs_missing?: boolean;
  estimated_avg_daily_m3?: number | null;
  estimated_avg_hourly_m3?: number | null;
  /** Total volume in scope: meter sum or estimated (see volume_basis). */
  calculated_total_m3?: number | null;
  calculated_avg_daily_m3?: number | null;
  calculated_avg_hourly_m3?: number | null;
  /** Sum of per-log interval volumes (meter deltas), not cumulative readings. */
  total_water_pumped_m3: number | null;
  /** Cumulative bulk-meter reading at the most recent log in scope. */
  latest_meter_reading_end_m3?: number | null;
  /** Latest cumulative reading minus first baseline in scope. */
  period_meter_net_m3?: number | null;
  total_pump_hours_h: number;
  days_logged: number;
  logs_count: number;
  avg_m3_per_hour?: number | null;
  avg_m3_per_day_logged?: number | null;
  avg_hours_per_day_logged?: number | null;
  /** Design fill time / actual fill time; null when either is missing. */
  pumping_efficiency?: number | null;
  /** η × pump flow rate × pump hours in scope; an estimate, not a meter reading. */
  estimated_water_m3?: number | null;
};

export type SolarSystemDetailRow = {
  solar_system_id: string;
  unique_identifier?: string | null;
  tehsil: string;
  village: string;
  settlement?: string | null;
  site_type?: string | null;
  disco_info?: string | null;
  bill_reference_number?: string | null;
  /** Solar connection date, YYYY-MM-DD. */
  solar_connection_date?: string | null;
  total_export_kwh: number;
  total_export_off_peak_kwh?: number | null;
  total_export_peak_kwh?: number | null;
  total_import_kwh: number;
  total_import_off_peak_kwh?: number | null;
  total_import_peak_kwh?: number | null;
  total_net_kwh: number;
  total_net_off_peak_kwh?: number | null;
  total_net_peak_kwh?: number | null;
  any_tou_required?: boolean | null;
  months_logged: number;
  records_count: number;
  avg_export_kwh_per_month?: number | null;
  avg_import_kwh_per_month?: number | null;
  avg_net_kwh_per_month?: number | null;
  /** YYYY-MM-DD; months before it are "before green meter" logs. */
  green_meter_connection_date?: string | null;
  /** Before green meter baseline (units consumed, nothing exported). */
  pre_green_months_logged?: number | null;
  pre_green_consumed_kwh?: number | null;
  pre_green_consumed_peak_kwh?: number | null;
  pre_green_consumed_off_peak_kwh?: number | null;
  avg_pre_green_consumed_kwh_per_month?: number | null;
  /** % change of avg monthly grid import vs the pre-green baseline. */
  grid_draw_change_pct?: number | null;
};

export const EXECUTIVE_YEARS = [2025, 2026, 2027, 2028, 2029] as const;

export const EXECUTIVE_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
