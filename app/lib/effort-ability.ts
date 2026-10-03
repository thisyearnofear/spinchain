/**
 * EffortAbility — fitness-gated delight moments (wedge foreground).
 *
 * Two curated moments only. Fitness is the input, VFX is the output.
 * No mouse-aim, no editors, no new renderers. Pure functions so the
 * thresholds are unit-testable and the React layer stays thin.
 *
 * 1. Sprint = beam: power above threshold during sprint/interval holds a
 *    beam + floor burn. Dies when watts die.
 * 2. Flow = unlock: flow tier 3+ opens the ring-snap + pillar treatment.
 *    Earned by consistency (flow-state.ts), not clicks.
 */

import type { IntervalPhase } from "./phase-theme";
import type { FlowStateTier } from "./flow-state";

export const SPRINT_BEAM = {
  /** Absolute power floor — beam never shows below this. */
  MIN_POWER_W: 180,
  /** Effort (0-1000 scale, same as computePhaseTheme input) floor. */
  MIN_EFFORT: 400,
  /** Phases where the beam can arm. */
  ARMED_PHASES: ["sprint", "interval"] as IntervalPhase[],
} as const;

export interface SprintBeamState {
  active: boolean;
  /** 0-1 hold strength — drives opacity/width/pulse. */
  intensity: number;
}

export function getSprintBeamState(
  phase: IntervalPhase,
  powerW: number,
  effort: number,
): SprintBeamState {
  if (!SPRINT_BEAM.ARMED_PHASES.includes(phase)) {
    return { active: false, intensity: 0 };
  }
  if (!Number.isFinite(powerW) || !Number.isFinite(effort)) {
    return { active: false, intensity: 0 };
  }
  if (powerW < SPRINT_BEAM.MIN_POWER_W || effort < SPRINT_BEAM.MIN_EFFORT) {
    return { active: false, intensity: 0 };
  }
  // Ramp 0→1 across MIN→2x MIN so the beam grows with the effort, not a switch.
  const powerMix = Math.min(1, (powerW - SPRINT_BEAM.MIN_POWER_W) / SPRINT_BEAM.MIN_POWER_W);
  const effortMix = Math.min(1, (effort - SPRINT_BEAM.MIN_EFFORT) / (1000 - SPRINT_BEAM.MIN_EFFORT));
  const intensity = Math.round(Math.min(1, powerMix * 0.6 + effortMix * 0.4) * 100) / 100;
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
