export const ALL_TEHSILS_FILTER = 'All Tehsils';

/** Single tehsil, explicit multi-tehsil CSV, or undefined = no tehsil narrowing. */
export function resolveTehsilScope(
  tehsil?: string,
  tehsilsCsv?: string,
): string[] | undefined {
  const t = tehsil?.trim();
  if (t && t !== ALL_TEHSILS_FILTER) return [t];
  const csv = tehsilsCsv?.trim();
  if (!csv) return undefined;
  return [
    ...new Set(
      csv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/** Requested tehsil scope limited to what the caller may access. */
export function intersectTehsilScope(
  allowedTehsils: string[],
  tehsil?: string,
  tehsilsCsv?: string,
): string[] {
  const scope = resolveTehsilScope(tehsil, tehsilsCsv);
  if (!scope?.length) return allowedTehsils;
  const allowed = new Set(allowedTehsils);
  return scope.filter((t) => allowed.has(t));
}
