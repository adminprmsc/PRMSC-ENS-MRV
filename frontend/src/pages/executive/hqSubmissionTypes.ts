export type HqSubmissionRow = {
  id: string;
  /** Daily water log record id (when available from queue API) */
  record_id?: string | null;
  submission_type: string;
  status: string;
  operator_name?: string;
  operator_email?: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
  remarks?: string | null;
  system_info?: {
    id?: string;
    uid?: string;
    village?: string;
    tehsil?: string;
    /** YYYY-MM-DD calendar day of the operator log */
    log_date?: string | null;
    year?: number;
    month?: number;
    day?: number;
    pump_start_time?: string | null;
    pump_end_time?: string | null;
    pump_operating_hours?: number | null;
    total_water_pumped?: number | null;
    last_edited_at?: string | null;
    bulk_meter_image_url?: string | null;
  };
};

export type HqSubmissionScope = {
  year?: number;
  month?: number;
  /** YYYY-MM-DD when filtering to a single calendar day */
  logDate?: string;
};

export function submissionLogDateKey(row: HqSubmissionRow): string | null {
  const iso = row.system_info?.log_date?.trim();
  if (iso && /^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
  const y = row.system_info?.year;
  const m = row.system_info?.month;
  const d = row.system_info?.day;
  if (y != null && m != null && d != null) {
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  // Fallback: submitted day is weaker but better than month-only.
  const fallback = row.submitted_at ?? row.reviewed_at;
  if (fallback) {
    const parsed = new Date(fallback);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return null;
}
