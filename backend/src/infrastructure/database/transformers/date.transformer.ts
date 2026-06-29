import type { ValueTransformer } from 'typeorm';

/** Parse PostgreSQL `date` / ISO date strings into UTC midnight `Date`. */
export function parsePgDate(value: unknown): Date | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const d = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? new Date(`${trimmed}T00:00:00.000Z`)
      : new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** TypeORM transformer: PostgreSQL `date` columns → `Date` on read. */
export const dateColumnTransformer: ValueTransformer = {
  to: (value: Date | string | null | undefined) => {
    if (value == null) {
      return null;
    }
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    return String(value).slice(0, 10);
  },
  from: (value: unknown) => parsePgDate(value),
};

/** Parse timestamp values from PostgreSQL (string or Date). */
export function parsePgTimestamp(value: unknown): Date | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export const timestampColumnTransformer: ValueTransformer = {
  to: (value: Date | null | undefined) => value ?? null,
  from: (value: unknown) => parsePgTimestamp(value),
};
