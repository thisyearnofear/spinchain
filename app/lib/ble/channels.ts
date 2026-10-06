import type { ChannelPresence, FitnessMetrics } from "./types";

/**
 * Accumulate which channels a device has actually notified since connecting.
 *
 * Channels accumulate because the wire doesn't deliver them together: FTMS
 * folds speed, cadence and watts into one notification, heart rate arrives from
 * a separate characteristic at its own rate, and a combined sensor may report
 * them on different ticks.
 *
 * This must be computed from the *incoming partial* before anything zero-fills
 * it. Both BLE transports collapse an absent channel into `0`, and only here is
 * "the rider stopped pedaling" still distinguishable from "this bike has no
 * watts channel" — a distinction the effort model cannot recover afterwards.
 *
 * One function because two transports have to answer it identically: if the web
 * and native builds disagree about which channels exist, a rider gets a
 * different world from the same equipment.
 */
export function observeChannels(
  seen: ChannelPresence | undefined,
  next: Partial<FitnessMetrics>,
): ChannelPresence {
  const reported = (key: keyof ChannelPresence) =>
    seen?.[key] === true || next[key] !== undefined;

  return {
    power: reported("power"),
    cadence: reported("cadence"),
    heartRate: reported("heartRate"),
    speed: reported("speed"),
  };
}
