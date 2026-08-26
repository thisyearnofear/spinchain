import { VISUALIZER_THEMES } from "./visualizer-theme";

/**
 * WorldReactivity — Makes the 3D ride world react to the rider's effort and phase.
 *
 * The 3D world is currently a static backdrop. This layer makes it responsive:
 * - Road glow shifts color with interval phase (sprint→red, recovery→blue)
 * - Road emissive intensity surges with power
 * - Sky gradient shifts with phase
 * - Fog density/color shifts with effort
 * - Ambient + directional light colors shift with phase
 * - Prop buildings react (pulse more during high effort)
 * - Speed lines accelerate with cadence during sprints
 * - Rider aura intensifies with heart rate and effort
 * - Camera FOV narrows during flow state (tunnel vision effect)
 * - Particles rush past during sprints
 * - Stars rotate faster during high effort
 * - Grid lines pulse during sprints
 *
 * Design: computes reactive parameters once per frame and passes them to
 * sub-components via refs (no React state updates in useFrame).
 */

import { useMemo } from "react";
import type { VisualizerTheme } from "./visualizer-theme";
import type { IntervalPhase } from "@/app/lib/workout-plan";

// ─── Reactive parameters ────────────────────────────────────────────

export interface ReactiveParams {
  // Road
  roadGlowColor: string;
  roadGlowIntensity: number;
  roadBaseEmissive: number;

  // Lighting
  ambientIntensity: number;
  ambientColor: string;
  pointLightColor: string;
  pointLightIntensity: number;

  // Fog
  fogColor: string;
  fogDensity: number;

  // Sky
  skyTopColor: string;
  skyBottomColor: string;

  // Camera
  fov: number;
  fovTarget: number;

  // Props
  propEmissiveIntensity: number;
  propPulseSpeed: number;

  // Speed lines
  speedLineSpeed: number;
  speedLineColor: string;
  speedLineOpacity: number;

  // Rider
  riderAuraOpacity: number;
  riderAuraScale: number;
  riderTrailColor: string;
  riderLightIntensity: number;

  // Particles
  sparkleOpacity: number;
  sparkleSpeed: number;
  sparkleColor: string;
  starsRotationSpeed: number;

  // Grid
  gridColor: string;
  gridOpacity: number;

  // Post effects
  bloomIntensity: number;
  chromaticOffset: number;
  vignetteDarkness: number;
}

// ─── Color interpolation helpers ────────────────────────────────────

function lerpColor(
  c1: string,
  c2: string,
  t: number
): string {
  // Parse hex colors
  const parse = (c: string) => {
    const hex = c.replace("#", "");
    return [
      parseInt(hex.substring(0, 2), 16),
      parseInt(hex.substring(2, 4), 16),
      parseInt(hex.substring(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = parse(c1);
  const [r2, g2, b2] = parse(c2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ─── Main reactive params computation ──────────────────────────────

export function computeReactiveParams(
  theme: VisualizerTheme,
  stats: { power: number; hr: number; cadence: number },
  intervalPhase: IntervalPhase,
  progress: number,
): ReactiveParams {
  // ─── Normalized effort (0-1) ───────────────────────────────────
  const effort = Math.min(1, (stats.power / 400) ** 0.6); // compressed curve
  const cadenceFactor = Math.min(1, stats.cadence / 120);
  const hrFactor = Math.min(1, stats.hr / 190);

  // ─── Phase color mapping ───────────────────────────────────────
  const phaseColors: Record<string, {
    roadGlow: string;
    fog: string;
    skyTop: string;
    skyBottom: string;
    pointLight: string;
    ambient: string;
    speedLine: string;
    grid: string;
  }> = {
    sprint: {
      roadGlow: "#f43f5e",
      fog: "#1a0a0a",
      skyTop: "#1a0505",
      skyBottom: "#4a0a0a",
      pointLight: "#f97316",
      ambient: "#3a1010",
      speedLine: "#fb7185",
      grid: "#f43f5e",
    },
    interval: {
      roadGlow: "#f59e0b",
      fog: "#1a1505",
      skyTop: "#1a1505",
      skyBottom: "#4a3505",
      pointLight: "#fbbf24",
      ambient: "#3a3010",
      speedLine: "#fbbf24",
      grid: "#f59e0b",
    },
    warmup: {
      roadGlow: "#34d399",
      fog: "#051a10",
      skyTop: "#051a10",
      skyBottom: "#0a3a20",
      pointLight: "#34d399",
      ambient: "#103a20",
      speedLine: "#34d399",
      grid: "#34d399",
    },
    recovery: {
      roadGlow: "#38bdf8",
      fog: "#05101a",
      skyTop: "#05101a",
      skyBottom: "#0a2a4a",
      pointLight: "#818cf8",
      ambient: "#101a3a",
      speedLine: "#38bdf8",
      grid: "#38bdf8",
    },
    cooldown: {
      roadGlow: "#818cf8",
      fog: "#0a051a",
      skyTop: "#0a051a",
      skyBottom: "#1a0a3a",
      pointLight: "#a78bfa",
      ambient: "#1a103a",
      speedLine: "#818cf8",
      grid: "#818cf8",
    },
  };

  const phase = phaseColors[intervalPhase ?? "interval"] ?? phaseColors.interval;
  const themeStyles = {
    roadEmissive: `#${VISUALIZER_THEMES[theme].roadEmissive}`,
    lineColor: `#${VISUALIZER_THEMES[theme].lineColor}`,
    riderColor: `#${VISUALIZER_THEMES[theme].riderColor}`,
    particleColor: `#${VISUALIZER_THEMES[theme].particleColor}`,
    fog: VISUALIZER_THEMES[theme].fog,
    skyTop: VISUALIZER_THEMES[theme].skyTop,
    skyBottom: VISUALIZER_THEMES[theme].skyBottom,
    horizonGlow: VISUALIZER_THEMES[theme].horizonGlow,
    gridColor: theme === "rainbow" ? "#ff00ff" : "#2a1d5a",
  };

  // Blend phase color with base theme (phase influence scales with effort)
  const phaseInfluence = effort; // 0.0 (neutral) → 1.0 (full phase color)

  // ─── Compute all parameters ────────────────────────────────────

  // Road: color and intensity
  const roadGlowColor = lerpColor(themeStyles.roadEmissive, phase.roadGlow, phaseInfluence);
  const roadBaseEmissive = 0.2 + effort * 0.8; // 0.2 → 1.0
  const roadGlowIntensity = 0.2 + cadenceFactor * 0.3 + (intervalPhase === "sprint" ? effort * 0.5 : 0);

  // Lighting
  const ambientIntensity = lerp(0.5, 0.3, effort); // dim ambient during high effort for more contrast
  const ambientColor = lerpColor("#9b7bff", phase.ambient, phaseInfluence * 0.5);
  const pointLightColor = lerpColor(theme === "mars" ? "#ef4444" : theme === "rainbow" ? "#ff00ff" : "#9b7bff", phase.pointLight, phaseInfluence * 0.6);
  const pointLightIntensity = lerp(1, 2.5, effort);

  // Fog: denser during high effort, phase-colored
  const fogDensity = lerp(40, 20, effort); // closer fog = more intensity
  const fogColor = lerpColor(themeStyles.fog, phase.fog, phaseInfluence);

  // Sky gradient
  const skyTopColor = lerpColor(themeStyles.skyTop, phase.skyTop, phaseInfluence);
  const skyBottomColor = lerpColor(themeStyles.skyBottom, phase.skyBottom, phaseInfluence);

  // Camera FOV: widens during sprints (100° at max sprint), narrows during recovery (55°)
  let fovTarget = 60;
  if (intervalPhase === "sprint") {
    fovTarget = 60 + effort * 40; // 60° → 100°
  } else if (intervalPhase === "recovery" || intervalPhase === "cooldown") {
    fovTarget = 60 - effort * 10; // 50° → 60°
  } else {
    fovTarget = 60 + effort * 25; // 60° → 85°
  }

  // Props: emissive intensity increases with effort
  const propEmissiveIntensity = 0.5 + effort * 1.5; // 0.5 → 2.0
  const propPulseSpeed = 1 + cadenceFactor * 2;

  // Speed lines: speed and count increase with cadence
  const speedLineSpeed = 0.5 + cadenceFactor * 2; // 0.5 → 2.5
  const speedLineColor = lerpColor(themeStyles.lineColor, phase.speedLine, phaseInfluence);
  const speedLineOpacity = 0.3 + effort * 0.5; // 0.3 → 0.8

  // Rider: aura and trail intensify
  const riderAuraOpacity = 0.05 + (stats.power / 2000) + (hrFactor * 0.1); // 0.05 → 0.55
  const riderAuraScale = 1 + effort * 0.5 + (hrFactor * 0.2); // 1.0 → 1.7
  const riderTrailColor = lerpColor(themeStyles.riderColor, phase.roadGlow, phaseInfluence * 0.5);
  const riderLightIntensity = 5 + effort * 15 + (hrFactor * 3); // 5 → 23

  // Particles
  const sparkleOpacity = Math.min(0.7, 0.1 + effort * 0.6);
  const sparkleSpeed = 0.3 + cadenceFactor * 0.7; // 0.3 → 1.0
  const sparkleColor = lerpColor(themeStyles.particleColor, phase.speedLine, phaseInfluence * 0.4);

  // Stars
  const starsRotationSpeed = 0.5 + effort * 1.5; // 0.5 → 2.0

  // Grid: only for themes that have it
  const gridOpacity = effort * 0.6;
  const gridColor = lerpColor(themeStyles.gridColor, phase.grid, phaseInfluence);

  // Post effects
  const bloomIntensity = 0.5 + effort * 2.5; // 0.5 → 3.0
  const chromaticOffset = effort * 0.008; // 0 → 0.008
  const vignetteDarkness = lerp(0.8, 1.0, effort); // 0.8 → 1.0

  return {
    roadGlowColor,
    roadGlowIntensity,
    roadBaseEmissive,
    ambientIntensity,
    ambientColor,
    pointLightColor,
    pointLightIntensity,
    fogColor,
    fogDensity,
    skyTopColor,
    skyBottomColor,
    fov: fovTarget,
    fovTarget,
    propEmissiveIntensity,
    propPulseSpeed,
    speedLineSpeed,
    speedLineColor,
    speedLineOpacity,
    riderAuraOpacity,
    riderAuraScale,
    riderTrailColor,
    riderLightIntensity,
    sparkleOpacity,
    sparkleSpeed,
    sparkleColor,
    starsRotationSpeed,
    gridColor,
    gridOpacity,
    bloomIntensity,
    chromaticOffset,
    vignetteDarkness,
  };
}

// VISUALIZER_THEMES reference needed for color lookups
// (imported at top)