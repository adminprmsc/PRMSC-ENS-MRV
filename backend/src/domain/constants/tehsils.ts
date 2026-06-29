/**
 * Fixed tehsil list — must match operational geography (see frontend TEHSIL_OPTIONS).
 * Water-system locations and tehsil-manager tehsil assignments are validated here.
 *
 * Tubewell operators are not assigned tehsils directly: they receive water systems
 * (registered under a tehsil); their effective tehsils are derived from those systems.
 */

export const PREDEFINED_TAHSILS: readonly string[] = [
  'AHMADPUR SIAL',
  'ALIPUR',
  'BAHAWALNAGAR',
  'BHOWANA',
  'DARYA KHAN',
  'ISA KHEL',
  'KALLAR KAHAR',
  'KAHROR PACCA',
  'KHAIRPUR TAMEWALI',
  'KOT MOMIN',
  'LIAQATPUR',
  'NOORPUR THAL',
  'PAKPATTAN',
  'ROJHAN',
  'SHUJABAD',
  'TAUNSA',
] as const;

const PREDEFINED_UPPER = new Map(
  PREDEFINED_TAHSILS.map((t) => [t.toUpperCase(), t]),
);

export function canonicalTehsil(
  name: string | null | undefined,
): string | null {
  if (!name || typeof name !== 'string') {
    return null;
  }
  return PREDEFINED_UPPER.get(name.trim().toUpperCase()) ?? null;
}

export function isValidTehsil(name: string | null | undefined): boolean {
  return canonicalTehsil(name) !== null;
}

/**
 * Return a deduplicated list of canonical tehsil names (e.g. for tehsil managers).
 * Throws if empty or any value is not predefined.
 *
 * Not used for tubewell operator onboarding — operators get water_system_ids only.
 */
export function validateTehsilAssignments(tehsils: unknown): string[] {
  if (!tehsils || !Array.isArray(tehsils)) {
    throw new Error('tehsils must be a non-empty list');
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of tehsils) {
    const c = canonicalTehsil(raw != null ? String(raw).trim() : '');
    if (!c) {
      throw new Error(`Unknown or invalid tehsil: ${String(raw)}`);
    }
    if (!seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  if (out.length === 0) {
    throw new Error('At least one valid tehsil is required');
  }
  return out;
}
