export const SOLAR_SITE_TYPES = ['ABR', 'Tubewell', 'RO Plant'] as const;

export type SolarSiteType = (typeof SOLAR_SITE_TYPES)[number];

export function normalizeSolarSiteType(
  raw: unknown,
): SolarSiteType | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const match = SOLAR_SITE_TYPES.find(
    (t) => t.toLowerCase() === s.toLowerCase(),
  );
  return match ?? null;
}

export function isValidSolarSiteType(
  raw: unknown,
): raw is SolarSiteType {
  return normalizeSolarSiteType(raw) !== null;
}
