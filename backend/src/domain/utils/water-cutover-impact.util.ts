import { logKey, wallClockKey, type WaterLogLike } from './water-source.util';

/**
 * What changing a site's bulk-meter start (cutover) would do to logs that
 * already exist. Used to protect measured data:
 *  - `ignoredMeterReadings`: metered logs BEFORE the new start — their meter
 *    volume would be replaced by an estimate. Refused (measured data wins).
 *  - `newlyUnmetered`: hours-only logs AT/AFTER the new start — they would
 *    count no volume until a reading is added. Allowed, with a warning.
 */
export function cutoverImpact(
  logs: WaterLogLike[],
  newDate: Date | string | null,
  newTime: string | null,
): {
  cutover: string | null;
  ignoredMeterReadings: string[];
  newlyUnmetered: number;
} {
  const cutover = wallClockKey(newDate, newTime);
  if (!cutover)
    return { cutover: null, ignoredMeterReadings: [], newlyUnmetered: 0 };
  const ignored: string[] = [];
  let unmetered = 0;
  for (const l of logs) {
    const k = logKey(l);
    if (!k) continue;
    if (k < cutover && l.meterReadingEnd != null) ignored.push(k.slice(0, 16));
    if (k >= cutover && l.meterReadingEnd == null) unmetered += 1;
  }
  ignored.sort();
  return { cutover, ignoredMeterReadings: ignored, newlyUnmetered: unmetered };
}
