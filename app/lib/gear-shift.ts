/**
 * Single source of truth for shifting gear.
 *
 * Two inputs can shift: the keyboard (↑/↓ on desktop) and the on-screen
 * shifter in the PedalSimulator (phones and tablets have no arrow keys).
 * Both go through here so the telemetry store and the ride engine can never
 * disagree about what gear the rider is in.
 */

import { DEFAULT_ROAD_GEARS } from "@/app/lib/analytics/physiological-models";
import { useTelemetryStore } from "@/app/stores/telemetry-store";

/** Total gear count for the default road setup (1 = lowest, N = highest). */
export const TOTAL_GEARS = DEFAULT_ROAD_GEARS.front.length * DEFAULT_ROAD_GEARS.rear.length;

/**
 * Shift the current gear by `delta`, clamped to [1, TOTAL_GEARS].
 *
 * `syncToEngine` is how the ride engine learns about the change — pass
 * `coordinator.setCurrentGear`. It is optional because the engine may not
 * exist yet; the store write alone keeps the UI correct.
 *
 * Returns the gear after the shift.
 */
export function shiftGear(delta: number, syncToEngine?: (gear: number) => void): number {
  const { currentGear } = useTelemetryStore.getState();
  const next = Math.min(TOTAL_GEARS, Math.max(1, currentGear + delta));
  if (next === currentGear) return next;
  useTelemetryStore.setState({ currentGear: next });
  syncToEngine?.(next);
  return next;
}
