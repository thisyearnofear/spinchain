/**
 * EffortAbility — fitness-gated delight moments (wedge foreground).
 *
 * Two curated moments only. Fitness is the input, VFX is the output.
 * No mouse-aim, no editors, no new renderers. Pure functions so the
 * thresholds are unit-testable and the React layer stays thin.
 *
 * 1. Sprint = beam: working above the rider's own threshold during
 *    sprint/interval holds a beam + floor burn. Dies when the effort dies.
 * 2. Flow = unlock: flow tier 3+ opens the ring-snap + pillar treatment.
 *    Earned by consistency (flow-state.ts), not clicks.
 */

import type { IntervalPhase } from "./phase-theme";
import type { FlowStateTier } from "./flow-state";
import { RIDE_EFFORT } from "./ride-effort";

export const SPRINT_BEAM = {
  /**
   * Rider-relative intensity floor (app/lib/ride-effort: 1.0 = this rider's
   * threshold). A sprint is work above threshold, so the beam arms there —
   * for a beginner at their 140 W FTP and a racer at their 320 W alike.
   */
  MIN_INTENSITY: 1,
  /** Phases where the beam can arm. */
  ARMED_PHASES: ["sprint", "interval"] as IntervalPhase[],
} as const;

export interface SprintBeamState {
  active: boolean;
  /** 0-1 hold strength — drives opacity/width/pulse. */
  intensity: number;
}

/**
 * @param riderIntensity rider-relative intensity, 0–RIDE_EFFORT.INTENSITY_MAX,
 *   read from `snapshot.intensity` so the beam judges effort against the same
 *   anchors the rest of the world does. Never absolute watts or the 0–1000
 *   reward `effort` score.
 */
export function getSprintBeamState(
  phase: IntervalPhase,
  riderIntensity: number,
): SprintBeamState {
  if (!SPRINT_BEAM.ARMED_PHASES.includes(phase)) {
    return { active: false, intensity: 0 };
  }
  if (!Number.isFinite(riderIntensity) || riderIntensity < SPRINT_BEAM.MIN_INTENSITY) {
    return { active: false, intensity: 0 };
  }
  // Ramp 0→1 from threshold to the intensity cap so the beam grows with the
  // effort, not a switch.
  const span = RIDE_EFFORT.INTENSITY_MAX - SPRINT_BEAM.MIN_INTENSITY;
  const mix = Math.min(1, (riderIntensity - SPRINT_BEAM.MIN_INTENSITY) / span);
  const intensity = Math.round(mix * 100) / 100;
  return { active: intensity > 0, intensity };
}

export function shouldShowFlowUnlock(tier: FlowStateTier): boolean {
  return tier >= 3;
}

/** Visual params for the flow-unlock treatment (ring snap + pillar glow). */
export function getFlowUnlockParams(tier: FlowStateTier): {
  active: boolean;
  glowOpacity: number;
  ringScale: number;
} {
  if (!shouldShowFlowUnlock(tier)) {
    return { active: false, glowOpacity: 0, ringScale: 1 };
  }
  // Tier 3: strong. Tier 4: peak. No further escalation — rarity matters.
  return tier >= 4
    ? { active: true, glowOpacity: 0.5, ringScale: 1.15 }
    : { active: true, glowOpacity: 0.35, ringScale: 1.08 };
}
