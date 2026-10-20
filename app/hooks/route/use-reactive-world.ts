"use client";

import { useMemo } from "react";
import { computeReactiveParams } from "@/app/components/features/route/world-reactivity";
import type { VisualizerTheme } from "@/app/components/features/route/visualizer-theme";
import type { IntervalPhase } from "@/app/lib/phase-theme";
import type { FlowStateTier } from "@/app/lib/flow-state";
import { FLOW_COLORS } from "@/app/lib/flow-state";

interface ReactiveWorldParams {
  theme: VisualizerTheme;
  stats: { hr: number; power: number; cadence: number; intensity: number };
  intervalPhase: IntervalPhase | null;
  progress: number;
  mode: "preview" | "ride" | "finished";
  flowTier: FlowStateTier;
}

/**
 * useReactiveWorld — computes world-reactivity parameters scaled by flow tier.
 *
 * Extracted from Scene to keep rendering separate from derived-state logic.
 * Tier 0 = baseline, Tier 4 = 2.2x visual intensity.
 */
export function useReactiveWorld({
  theme,
  stats,
  intervalPhase,
  progress,
  mode,
  flowTier,
}: ReactiveWorldParams) {
  const FLOW_SCALING = [1, 1.2, 1.5, 1.8, 2.2];
  const flowScale = FLOW_SCALING[flowTier] ?? 1;

// Tier vocabulary from the flow engine — the same constants the HUD badge and
// the diegetic bike readout render. Tier 0's entry is "" so compare with `||`
// (not `??`) when mapping to a nullable color.
const flowColor = (FLOW_COLORS[flowTier] as string) || null;
  const showFlowEffects = flowTier >= 1;

  const reactive = useMemo(() => {
    if (mode !== "ride") return null;
    const base = computeReactiveParams(theme, stats, intervalPhase, progress);
    return {
      ...base,
      bloomIntensity: base.bloomIntensity * flowScale,
      chromaticOffset: base.chromaticOffset * flowScale,
      vignetteDarkness: Math.min(1, base.vignetteDarkness + flowTier * 0.05),
      fogDensity: Math.max(15, base.fogDensity - flowTier * 5),
      starsRotationSpeed: base.starsRotationSpeed * flowScale,
      sparklesSpeed: base.sparkleSpeed * flowScale,
      sparkleOpacity: Math.min(0.8, base.sparkleOpacity + flowTier * 0.05),
      roadGlowIntensity: base.roadGlowIntensity * flowScale,
      riderAuraScale: base.riderAuraScale * (1 + flowTier * 0.15),
      riderLightIntensity: base.riderLightIntensity * flowScale,
    };
  }, [theme, stats, intervalPhase, progress, mode, flowTier, flowScale]);

  return { reactive, flowScale, flowColor, showFlowEffects };
}
