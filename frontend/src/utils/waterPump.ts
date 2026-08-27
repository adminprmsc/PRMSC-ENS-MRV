/** Mechanical horsepower to kilowatts (1 HP = 0.7456 kW). */
export const HP_TO_KW = 0.7456;

export function pumpCapacityKwFromHp(
  horsePower: number | null | undefined,
): number | null {
  if (horsePower == null || Number.isNaN(horsePower)) return null;
  return Math.round(horsePower * HP_TO_KW * 1000) / 1000;
}

export function formatPumpCapacityKw(
  horsePower: number | null | undefined,
): string {
  const kw = pumpCapacityKwFromHp(horsePower);
  if (kw == null) return "—";
  return `${kw} kW`;
}

export function pumpCapacityKwInputValue(
  horsePower: number | null | undefined,
): string {
  const kw = pumpCapacityKwFromHp(horsePower);
  return kw == null ? "" : String(kw);
}
