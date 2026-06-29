/** Water log + submission workflow (tubewell operator ↔ tehsil manager). */

export const SUBMISSION_STATUS_DRAFTED = 'drafted';
export const SUBMISSION_STATUS_SUBMITTED = 'submitted';
export const SUBMISSION_STATUS_ACCEPTED = 'accepted';
export const SUBMISSION_STATUS_REJECTED = 'rejected';
export const SUBMISSION_STATUS_REVERTED_BACK = 'reverted_back';

export const METER_TYPE_TUBEWELL = 'tubewell';
export const METER_TYPE_SOLAR = 'solar';

/** Rows a tubewell operator may edit or delete (water_energy_logging_daily). */
export const WATER_LOG_OPERATOR_EDITABLE: ReadonlySet<string> = new Set([
  SUBMISSION_STATUS_DRAFTED,
  SUBMISSION_STATUS_REVERTED_BACK,
]);

export enum SubmissionStatus {
  DRAFTED = SUBMISSION_STATUS_DRAFTED,
  SUBMITTED = SUBMISSION_STATUS_SUBMITTED,
  ACCEPTED = SUBMISSION_STATUS_ACCEPTED,
  REJECTED = SUBMISSION_STATUS_REJECTED,
  REVERTED_BACK = SUBMISSION_STATUS_REVERTED_BACK,
}

export enum MeterType {
  TUBEWELL = METER_TYPE_TUBEWELL,
  SOLAR = METER_TYPE_SOLAR,
}

/** Map API/legacy values to canonical status strings. */
export function normalizeWaterSubmissionStatus(
  value: string | null | undefined,
): string {
  if (value == null || (typeof value === 'string' && !value.trim())) {
    return SUBMISSION_STATUS_DRAFTED;
  }
  const v = String(value).trim().toLowerCase();
  if (v === 'draft') {
    return SUBMISSION_STATUS_DRAFTED;
  }
  const legacy: Record<string, string> = {
    under_review: SUBMISSION_STATUS_SUBMITTED,
    verified: SUBMISSION_STATUS_ACCEPTED,
    approved: SUBMISSION_STATUS_ACCEPTED,
  };
  if (v in legacy) {
    return legacy[v];
  }
  const canon: Record<string, string> = {
    drafted: SUBMISSION_STATUS_DRAFTED,
    submitted: SUBMISSION_STATUS_SUBMITTED,
    accepted: SUBMISSION_STATUS_ACCEPTED,
    rejected: SUBMISSION_STATUS_REJECTED,
    reverted_back: SUBMISSION_STATUS_REVERTED_BACK,
  };
  return canon[v] ?? String(value).trim();
}
