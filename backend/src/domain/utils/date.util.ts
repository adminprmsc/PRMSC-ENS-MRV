import {
  parsePgDate,
  parsePgTimestamp,
} from '../../infrastructure/database/transformers/date.transformer';

export function toIsoDateString(value: unknown): string | null {
  const d = parsePgDate(value) ?? parsePgTimestamp(value);
  return d ? d.toISOString().slice(0, 10) : null;
}

export function toIsoDateTimeString(value: unknown): string | null {
  const d = parsePgTimestamp(value) ?? parsePgDate(value);
  return d ? d.toISOString() : null;
}

export function getCalendarYear(value: unknown): number | null {
  const d = parsePgDate(value) ?? parsePgTimestamp(value);
  return d ? d.getUTCFullYear() : null;
}

export function getCalendarMonth(value: unknown): number | null {
  const d = parsePgDate(value) ?? parsePgTimestamp(value);
  return d ? d.getUTCMonth() + 1 : null;
}

export function getCalendarDay(value: unknown): number | null {
  const d = parsePgDate(value) ?? parsePgTimestamp(value);
  return d ? d.getUTCDate() : null;
}

export function toDateMs(value: unknown): number {
  const d = parsePgDate(value) ?? parsePgTimestamp(value);
  return d ? d.getTime() : 0;
}
