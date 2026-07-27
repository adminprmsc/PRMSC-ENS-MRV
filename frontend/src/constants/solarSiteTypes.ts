export const SOLAR_SITE_TYPES = ["ABR", "Tubewell", "RO Plant"] as const;

export type SolarSiteType = (typeof SOLAR_SITE_TYPES)[number];

export function normalizeSolarSiteType(
  raw: string | null | undefined,
): SolarSiteType | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  return (
    SOLAR_SITE_TYPES.find((t) => t.toLowerCase() === s.toLowerCase()) ?? null
  );
}
