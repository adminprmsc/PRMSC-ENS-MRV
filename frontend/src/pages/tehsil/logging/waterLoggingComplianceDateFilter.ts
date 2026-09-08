import {
  getPakistanIsoDateString,
  subtractPakistanDays,
} from "../../../utils/pakistanTime";

/** Max inclusive days allowed by API (supports 2-month preset). */
export const WATER_COMPLIANCE_MAX_RANGE_DAYS = 62;

export type WaterComplianceFilterMode = "single" | "range";

export type WaterComplianceDatePreset = {
  id: string;
  label: string;
  days: number;
};

export const WATER_COMPLIANCE_DATE_PRESETS: WaterComplianceDatePreset[] = [
  { id: "7d", label: "7 days", days: 7 },
  { id: "14d", label: "14 days", days: 14 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "2mo", label: "2 months", days: 60 },
];

export function inclusiveDaySpan(dateFrom: string, dateTo: string): number {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const fromMs = new Date(`${dateFrom.slice(0, 10)}T00:00:00+05:00`).getTime();
  const toMs = new Date(`${dateTo.slice(0, 10)}T00:00:00+05:00`).getTime();
  return Math.floor((toMs - fromMs) / DAY_MS) + 1;
}

export function buildPresetDateRange(
  days: number,
  anchorTo: string = getPakistanIsoDateString(),
): { dateFrom: string; dateTo: string } {
  const dateTo = anchorTo;
  const dateFrom = subtractPakistanDays(dateTo, Math.max(0, days - 1));
  return { dateFrom, dateTo };
}

export function detectActivePreset(
  dateFrom: string,
  dateTo: string,
): string | null {
  if (!dateFrom || !dateTo) return null;
  const today = getPakistanIsoDateString();
  if (dateTo !== today) return null;

  for (const preset of WATER_COMPLIANCE_DATE_PRESETS) {
    const { dateFrom: from, dateTo: to } = buildPresetDateRange(preset.days, today);
    if (from === dateFrom && to === dateTo) return preset.id;
  }
  return null;
}

export function inferFilterMode(
  dateFrom: string,
  dateTo: string,
): WaterComplianceFilterMode {
  return dateFrom && dateTo && dateFrom === dateTo ? "single" : "range";
}

export type DateRangeValidation =
  | { ok: true }
  | { ok: false; message: string };

export function validateDateRange(
  dateFrom: string,
  dateTo: string,
): DateRangeValidation {
  if (!dateFrom || !dateTo) {
    return { ok: false, message: "Select a date or range." };
  }
  if (dateTo < dateFrom) {
    return { ok: false, message: "End date must be on or after start date." };
  }
  if (inclusiveDaySpan(dateFrom, dateTo) > WATER_COMPLIANCE_MAX_RANGE_DAYS) {
    return {
      ok: false,
      message: `Choose up to ${WATER_COMPLIANCE_MAX_RANGE_DAYS} days.`,
    };
  }
  return { ok: true };
}
