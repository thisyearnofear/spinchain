/**
 * Practice / demo ride timing helpers.
 *
 * Practice rides compress the full class timeline into a short wall-clock
 * demo (~PRACTICE_WALL_DURATION_SEC). The coordinator advances class-scaled
 * elapsedTime; HUD and completion surfaces convert back to wall time so the
 * UI reads as a Demo — not a 30-minute class.
 */

/** Wall-clock length of a compressed practice/demo ride (seconds). */
export const PRACTICE_WALL_DURATION_SEC = 45;

/** Class-seconds advanced per wall-clock second in practice mode. */
export function practiceClockScale(classDurationSec: number): number {
  return Math.max(1, classDurationSec / PRACTICE_WALL_DURATION_SEC);
}

/** Convert class-scaled elapsed seconds → wall-clock seconds. */
export function toPracticeWallElapsed(
  classElapsedSec: number,
  classDurationSec: number,
): number {
  const scale = practiceClockScale(classDurationSec);
  return Math.max(0, Math.floor(classElapsedSec / scale));
}

/** MM:SS for Demo HUD chips. */
export function formatPracticeClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}
