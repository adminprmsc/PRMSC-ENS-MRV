/**
 * Round decimal numbers inside free text to at most `digits` places and drop
 * trailing zeros ("1.8166666666666667" → "1.82", "55214.0" → "55214").
 * Used for notification messages stored before the backend rounded them.
 */
export function roundNumbersInText(text: string, digits = 2): string {
  if (!text) return text;
  return text.replace(/(?<![\d.])-?\d+\.\d+(?![\d.])/g, (m) => {
    const n = Number(m);
    if (!Number.isFinite(n)) return m;
    const r = Number(n.toFixed(digits));
    return String(Object.is(r, -0) ? 0 : r);
  });
}
