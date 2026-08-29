/**
 * Phase Theme Engine — computes the visual identity of the entire ride
 * based on the current interval phase and rider effort level.
 *
 * Every ride element (background, HUD accent, flow particles, screen edges)
 * reads from this engine so the whole experience is in sync.
 *
 * Phase hierarchy (highest to lowest intensity):
 *   sprint  → red/orange — screen shake, intense bloom, urgent audio
 *   interval → yellow/gold — moderate energy, steady pulse
 *   warmup  → green/teal — gentle awakening
 *   recovery → blue/sky — cool down, slow breath
 *   cooldown → purple/indigo — wind down
 *   cruise  → neutral warm — baseline cruising
 *
 * Effort modifier (0–1) scales opacity, scale, and pulse rate.
 */

export type IntervalPhase = "warmup" | "interval" | "sprint" | "recovery" | "cooldown" | "cruise" | null;

export const PHASE_COLORS = {
  sprint:   { primary: "#f43f5e", secondary: "#fb923c", bg: "rgba(244,63,94,0.08)",  glow: "rgba(244,63,94,0.15)",  particle: "#fb7185" },
  interval: { primary: "#fbbf24", secondary: "#f59e0b", bg: "rgba(251,191,36,0.06)",  glow: "rgba(251,191,36,0.12)",  particle: "#fcd34d" },
  warmup:   { primary: "#34d399", secondary: "#06b6d4", bg: "rgba(52,211,153,0.06)",  glow: "rgba(52,211,153,0.10)",  particle: "#6ee7b7" },
  recovery: { primary: "#38bdf8", secondary: "#818cf8", bg: "rgba(56,189,248,0.06)",  glow: "rgba(56,189,248,0.10)",  particle: "#7dd3fc" },
  cooldown: { primary: "#818cf8", secondary: "#a78bfa", bg: "rgba(129,140,248,0.06)", glow: "rgba(129,140,248,0.10)", particle: "#a5b4fc" },
  cruise:   { primary: "#fbbf24", secondary: "#fb923c", bg: "rgba(251,191,36,0.04)",  glow: "rgba(251,191,36,0.08)",  particle: "#fcd34d" },
} as const;

export type PhaseColorKey = keyof typeof PHASE_COLORS;

/**
 * INTENSITY_RAMP — the single "how hard am I going" language.
 *
 * Every effort signal (cadence zones, effort legends) maps onto this one
 * 5-step ramp with one shared legend, so the rider learns one color
 * vocabulary instead of several competing ones. Phase themes keep their
 * identity as *state* colors; flow tiers are a reward axis with their own
 * colors. The ramp hues deliberately match the hot end of the phase
 * palette (amber steady / rose sprint) so the systems read as family.
 */
export const INTENSITY_RAMP = [
  { key: "rest",   label: "Rest",   color: "#38bdf8" }, // sky — cooling down
  { key: "easy",   label: "Easy",   color: "#34d399" }, // emerald — warming up
  { key: "steady", label: "Steady", color: "#fbbf24" }, // amber — cruising
  { key: "push",   label: "Push",   color: "#fb923c" }, // orange — working
  { key: "sprint", label: "Sprint", color: "#f43f5e" }, // rose — all out
] as const;

export type IntensityStep = (typeof INTENSITY_RAMP)[number];

/** Map a cadence (rpm) onto the shared intensity ramp. */
export function cadenceToIntensity(cadence: number): IntensityStep {
  if (cadence === 0) return INTENSITY_RAMP[0];
  if (cadence < 60) return INTENSITY_RAMP[1];
  if (cadence < 80) return INTENSITY_RAMP[2];
  if (cadence < 100) return INTENSITY_RAMP[3];
  return INTENSITY_RAMP[4];
}

export interface PhaseTheme {
  color: string;
  bg: string;
  glow: string;
  particle: string;
  intensity: number;       // 0–1, derived from effort
  pulseRate: number;       // ms between pulse animations
  bloomMultiplier: number; // how much bloom to apply to the 3D scene
  screenPulseOpacity: number; // opacity of the red border on sprint
}

export function computePhaseTheme(phase: IntervalPhase, effort: number): PhaseTheme {
  const effortNorm = Math.max(0, Math.min(1, effort / 1000));
  const colorKey = phase as PhaseColorKey;
  const colors = PHASE_COLORS[colorKey] ?? PHASE_COLORS.cruise;

  // Sprint gets intensity floor; recovery gets effort dampening
  let intensity = effortNorm;
  if (phase === "sprint") intensity = Math.max(intensity, 0.5);
  if (phase === "recovery" || phase === "cooldown") intensity *= 0.6;

  // Pulse rate: faster during sprint, slower during recovery
  let pulseRate = 2000 - intensity * 1200; // 2s → 0.8s
  if (phase === "sprint") pulseRate = 400 + (1 - intensity) * 300; // 400–700ms
  if (phase === "recovery" || phase === "cooldown") pulseRate = 3000 + intensity * 1000; // 3–4s

  // Bloom multiplier for the 3D scene
  let bloomMultiplier = 0.8 + intensity * 0.6;
  if (phase === "sprint") bloomMultiplier += intensity * 0.8;
  if (phase === "recovery" || phase === "cooldown") bloomMultiplier *= 0.7;

  // Screen pulse: only visible during high-intensity moments
  let screenPulseOpacity = 0;
  if (phase === "sprint") screenPulseOpacity = 0.3 + intensity * 0.4;
  else if (phase === "interval" && intensity > 0.7) screenPulseOpacity = 0.1 + (intensity - 0.7) * 0.5;

  return {
    color: colors.primary,
    bg: colors.bg,
    glow: colors.glow,
    particle: colors.particle,
    intensity,
    pulseRate,
    bloomMultiplier: Math.round(bloomMultiplier * 100) / 100,
    screenPulseOpacity: Math.round(screenPulseOpacity * 100) / 100,
  };
}

/** Phase-to-label mapping for display */
export function phaseLabel(phase: IntervalPhase): string {
  if (!phase) return "Cruise";
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

/** Phase-to-accent CSS classes for Tailwind */
export function phaseAccent(phase: IntervalPhase): {
  text: string;
  border: string;
  bg: string;
  glow: string;
} {
  const map: Record<PhaseColorKey, { text: string; border: string; bg: string; glow: string }> = {
    sprint:   { text: "text-rose-400",  border: "border-rose-400/30",  bg: "bg-rose-500/12",  glow: "shadow-rose-500/20" },
    interval: { text: "text-amber-300", border: "border-amber-400/30", bg: "bg-amber-500/12", glow: "shadow-amber-500/20" },
    warmup:   { text: "text-emerald-300", border: "border-emerald-400/30", bg: "bg-emerald-500/12", glow: "shadow-emerald-500/20" },
    recovery: { text: "text-sky-300", border: "border-sky-400/30", bg: "bg-sky-500/12", glow: "shadow-sky-500/20" },
    cooldown: { text: "text-indigo-300", border: "border-indigo-400/30", bg: "bg-indigo-500/12", glow: "shadow-indigo-500/20" },
    cruise:   { text: "text-yellow-300", border: "border-yellow-400/30", bg: "bg-yellow-500/12", glow: "shadow-yellow-500/20" },
  };
  return map[phase as PhaseColorKey] ?? map.cruise;
}