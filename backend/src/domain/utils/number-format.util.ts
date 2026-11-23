/**
 * Human-readable number for notification/message text: at most `digits`
 * decimals, trailing zeros dropped (1.8166666 → "1.82", 55214.0 → "55214").
 * Null/undefined/non-finite → `fallback`.
 */
export function formatMessageNumber(
  value: number | string | null | undefined,
  digits = 2,
  fallback = 'N/A',
): string {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Number(n.toFixed(digits));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}
