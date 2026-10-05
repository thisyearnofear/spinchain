import { getTheme } from "@/app/lib/themes/registry";
import { visualEffort } from "@/app/lib/ride-effort";
import { ALPINE_POINT_COLOR } from "./alpine-atmosphere";
import { NEON_POINT_COLOR } from "./neon-atmosphere";

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
 * - Camera FOV widens during sprints (tunnel vision effect)
 * - Particles rush past during sprints
 * - Stars rotate faster during high effort
 * - Grid lines pulse during sprints
 *
 * Single source of truth: all phase colors and effort mapping derive from
 * computePhaseTheme() + PHASE_COLORS (app/lib/phase-theme.ts) — the same
 * vocabulary the HUD, background, and coach channel read. Dark world colors
 * (fog/sky/ambient) are mechanical darkenings of the phase primary, never a
 * parallel hand-picked palette. Do not reintroduce a local color table.
 *
 * Design: computes reactive parameters once per commit and passes them to
 * sub-components via refs (no React state updates in useFrame).
 */

import {
  computePhaseTheme,
  PHASE_COLORS,
  type IntervalPhase,
  type PhaseColorKey,
} from "@/app/lib/phase-theme";
import type { VisualizerTheme } from "./visualizer-theme";

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

  // Phase rhythm — ms between pulse beats, from computePhaseTheme().
  // Components use this instead of hardcoded modulo timings so the whole
  // world breathes at the phase's rate (sprint ≈400–700ms, recovery ≈3–4s).
  pulseMs: number;
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

/** Mix a phase color toward black — derives the world's dark variants
 *  (fog, sky, ambient) from the one shared phase palette. */
function darken(hex: string, amount: number): string {
  return lerpColor(hex, "#000000", amount);
}

// ─── Main reactive params computation ──────────────────────────────

export function computeReactiveParams(
  theme: VisualizerTheme,
  stats: { power: number; hr: number; cadence: number; intensity: number },
  intervalPhase: IntervalPhase,
  progress: number,
): ReactiveParams {
  // ─── Normalized effort (0-1) ───────────────────────────────────
  const effort = visualEffort(stats.intensity);
  const cadenceFactor = Math.min(1, stats.cadence / 120);
  const hrFactor = Math.min(1, stats.hr / 190);

  // ─── Phase theme (single source of truth) ─────────────────────
  // computePhaseTheme expects effort on the shared 0–1000 scale.
  const phaseTheme = computePhaseTheme(intervalPhase ?? "cruise", effort * 1000);
  const pc = PHASE_COLORS[(intervalPhase as PhaseColorKey) ?? "cruise"] ?? PHASE_COLORS.cruise;

  // World-surface colors derived from the shared phase palette. Dark
  // variants are mechanical darkenings — no parallel color table here.
  const phase = {
    roadGlow: pc.primary,
    fog: darken(pc.primary, 0.92),
    skyTop: darken(pc.primary, 0.94),
    skyBottom: darken(pc.primary, 0.8),
    pointLight: pc.secondary,
    ambient: darken(pc.primary, 0.85),
    speedLine: pc.particle,
    grid: pc.primary,
  };

  const themeStyles = {
    roadEmissive: getTheme(theme).roadEmissive,
    lineColor: getTheme(theme).lineColor,
    riderColor: getTheme(theme).riderColor,
    particleColor: getTheme(theme).particleColor,
    fog: getTheme(theme).fog,
    skyTop: getTheme(theme).skyTop,
    skyBottom: getTheme(theme).skyBottom,
    horizonGlow: getTheme(theme).horizonGlow,
    gridColor: theme === "rainbow" ? "#ff00ff" : "#2a1d5a",
  };

  // Blend phase color with base theme. Influence follows the phase theme's
  // intensity: sprint is floored at 0.5, recovery/cooldown damped — so the
  // world reads the phase even before the rider's effort climbs.
  const phaseInfluence = phaseTheme.intensity; // 0.0 (neutral) → 1.0 (full phase color)

  // ─── Compute all parameters ────────────────────────────────────

  // Road: color and intensity
  const roadGlowColor = lerpColor(themeStyles.roadEmissive, phase.roadGlow, phaseInfluence);
  const roadBaseEmissive = 0.2 + effort * 0.8; // 0.2 → 1.0
  const roadGlowIntensity = 0.2 + cadenceFactor * 0.3 + (intervalPhase === "sprint" ? effort * 0.5 : 0);

  // Lighting
  const ambientIntensity = lerp(0.5, 0.3, effort); // dim ambient during high effort for more contrast
  const ambientColor = lerpColor("#9b7bff", phase.ambient, phaseInfluence * 0.5);
  const pointLightBase =
    theme === "mars"
      ? "#ef4444"
      : theme === "rainbow"
        ? "#ff00ff"
        : theme === "alpine"
          ? ALPINE_POINT_COLOR
          : theme === "neon"
            ? NEON_POINT_COLOR
            : "#9b7bff";
  const pointLightColor = lerpColor(pointLightBase, phase.pointLight, phaseInfluence * 0.6);
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
  const riderAuraOpacity = 0.05 + effort * 0.4 + (hrFactor * 0.1); // 0.05 → 0.55
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

  // Post effects — bloom scales with the phase theme's bloom multiplier,
  // the same number the 2D background and HUD read.
  const bloomIntensity = Math.min(3.5, phaseTheme.bloomMultiplier * (0.4 + effort * 2.0));
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
    pulseMs: phaseTheme.pulseRate,
  };
}
