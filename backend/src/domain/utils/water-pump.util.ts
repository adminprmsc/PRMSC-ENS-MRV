/** Mechanical horsepower to kilowatts (1 HP = 0.7456 kW). */
export const HP_TO_KW = 0.7456;

export function pumpCapacityKwFromHp(
  horsePower: number | null | undefined,
): number | null {
  if (horsePower == null || Number.isNaN(horsePower)) return null;
  return Math.round(horsePower * HP_TO_KW * 1000) / 1000;
}
