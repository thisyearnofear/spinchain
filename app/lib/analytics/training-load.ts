/**
 * Training load — an honest, transparent 7-day fatigue signal derived from
 * the rider's own ride history (docs/CHARACTER-SYSTEM.md health principles:
 * no fake precision, celebrate recovery, never punish rest).
 *
 * This is a heuristic, not a medical metric: it counts hard rides in the
 * trailing 7 days. It never claims readiness or HRV-level insight — it only
 * answers "has this rider gone hard a lot lately?", which is exactly what a
 * good coach notices before suggesting an easy day.
 */

import type { RideSummary } from "./ride-history";

/** avgEffort (0–1000) at or above which a ride counts as "hard".
 *  Between the completion copy's "solid" (500) and "crushed it" (800). */
export const HARD_EFFORT_THRESHOLD = 600;

/** Hard rides within the trailing window that trigger the fatigue flag. */
export const FATIGUE_HARD_RIDE_COUNT = 3;

export const LOAD_WINDOW_DAYS = 7;

export interface WeeklyLoad {
  ridesLast7d: number;
  hardRidesLast7d: number;
  minutesLast7d: number;
  /** True when the rider has stacked enough hard rides that an easy day is
   *  the coaching-honest suggestion. */
  fatigued: boolean;
}

export function getWeeklyLoad(
  rides: RideSummary[],
  now: number = Date.now(),
): WeeklyLoad {
  const windowStart = now - LOAD_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = rides.filter((r) => r.completedAt >= windowStart && r.completedAt <= now);
  const hardRidesLast7d = recent.filter((r) => r.avgEffort >= HARD_EFFORT_THRESHOLD).length;
  const minutesLast7d = Math.round(
    recent.reduce((sum, r) => sum + r.durationSec, 0) / 60,
  );
  return {
    ridesLast7d: recent.length,
    hardRidesLast7d,
    minutesLast7d,
    fatigued: hardRidesLast7d >= FATIGUE_HARD_RIDE_COUNT,
  };
}
