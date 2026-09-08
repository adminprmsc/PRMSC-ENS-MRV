import {
  getPakistanIsoDateString,
  subtractPakistanDays,
} from "../../../utils/pakistanTime";

export type WaterComplianceDatePreset = {
  id: string;
  label: string;
  days: number;
};

export const WATER_COMPLIANCE_DATE_PRESETS: WaterComplianceDatePreset[] = [
  { id: "today", label: "Today", days: 1 },
  { id: "7d", label: "7 days", days: 7 },
  { id: "14d", label: "14 days", days: 14 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "2mo", label: "2 months", days: 60 },
];

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

export type DateRangeValidation =
  | { ok: true }
  | { ok: false; message: string };

export function validateDateRange(
  dateFrom: string,
  dateTo: string,
): DateRangeValidation {
  if (!dateFrom || !dateTo) {
    return { ok: false, message: "Select start and end dates." };
  }
  if (dateTo < dateFrom) {
    return { ok: false, message: "End date must be on or after start date." };
  }
  return { ok: true };
}
