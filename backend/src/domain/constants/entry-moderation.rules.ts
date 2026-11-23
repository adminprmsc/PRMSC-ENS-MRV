/**
 * Pure rules for Manager Operations overrides on approved data entries
 * (water daily logs, solar monthly logs). Kept free of I/O so every edge case
 * is unit-testable.
 */
import {
  SUBMISSION_STATUS_ACCEPTED,
  SUBMISSION_STATUS_REJECTED,
  normalizeWaterSubmissionStatus,
} from './submission.constants';

export const MODERATION_REASON_MIN_LENGTH = 10;
export const MODERATION_REASON_MAX_LENGTH = 1000;

export const MODERATION_LIST_DEFAULT_LIMIT = 200;
export const MODERATION_LIST_MAX_LIMIT = 500;

export type ModerationAction = 'reject' | 'delete';

export type ReasonResult =
  { ok: true; reason: string } | { ok: false; error: string };

/** Reason is mandatory, trimmed, and bounded so audit rows stay meaningful. */
export function normalizeModerationReason(raw: unknown): ReasonResult {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'A reason is required' };
  }
  const reason = raw.trim();
  if (!reason) {
    return { ok: false, error: 'A reason is required' };
  }
  if (reason.length < MODERATION_REASON_MIN_LENGTH) {
    return {
      ok: false,
      error: `Reason must be at least ${MODERATION_REASON_MIN_LENGTH} characters`,
    };
  }
  if (reason.length > MODERATION_REASON_MAX_LENGTH) {
    return {
      ok: false,
      error: `Reason must be at most ${MODERATION_REASON_MAX_LENGTH} characters`,
    };
  }
  return { ok: true, reason };
}

export type StatusCheck =
  { ok: true; status: string } | { ok: false; error: string };

/**
 * Which water-log statuses Manager Operations may act on.
 *  - reject: only `accepted` (in-flight entries belong to the tehsil manager workflow)
 *  - delete: `accepted`, or an entry already rejected (e.g. rejected first, then removed)
 */
export function checkWaterLogModeration(
  action: ModerationAction,
  rawStatus: string | null | undefined,
): StatusCheck {
  const status = normalizeWaterSubmissionStatus(rawStatus);
  if (action === 'reject') {
    if (status === SUBMISSION_STATUS_ACCEPTED) return { ok: true, status };
    if (status === SUBMISSION_STATUS_REJECTED) {
      return { ok: false, error: 'This water log has already been rejected' };
    }
    return {
      ok: false,
      error: `Only accepted water logs can be rejected (current status: '${status}')`,
    };
  }
  if (
    status === SUBMISSION_STATUS_ACCEPTED ||
    status === SUBMISSION_STATUS_REJECTED
  ) {
    return { ok: true, status };
  }
  return {
    ok: false,
    error: `Only accepted or rejected water logs can be deleted (current status: '${status}')`,
  };
}

/** Parse a `limit` query value into [1, MAX]; falls back to the default. */
export function parseModerationListLimit(raw: unknown): number {
  const n =
    typeof raw === 'string' || typeof raw === 'number'
      ? Number.parseInt(String(raw), 10)
      : NaN;
  if (!Number.isFinite(n) || n <= 0) return MODERATION_LIST_DEFAULT_LIMIT;
  return Math.min(n, MODERATION_LIST_MAX_LIMIT);
}

/** Strict YYYY-MM-DD that is a real calendar day. */
export function isIsoDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
