/**
 * Cloud atmosphere — the Cloud Kingdom's versions, keyed to how far the rider
 * has come.
 *
 * The authored piece already has four chapters along the route (open sea →
 * cathedral → into the light → open sky), and the world's geometry is anchored
 * to the same arc: cathedral towers at 0.20–0.40, the arch at 0.45, the
 * islands at 0.70–0.86. So the sky should not be one fixed mood with particles
 * bolted on — it should *become* its versions as you ride through them, on the
 * same stations the architecture uses.
 *
 * This module is only the score: air density, vista drift and a warmth bias,
 * per chapter. It does not touch the cloud geometry.
 *
 * The opening state is deliberately the shipped look — no grain in the air, no
 * horizon drift. Nothing about the world at the start of a ride has changed;
 * the air arrives and the horizon starts to breathe only as the ride opens out.
 * Easing is smootherstep between keys, so velocity is zero at every chapter
 * boundary and the atmosphere never ticks as it crosses one.
 */

/** 0..1 — how much of the grain field is in the air. */
export type AirDensity = number;

/**
 * A version of the sky. `at` is route progress (0..1).
 */
export interface CloudAtmosphereKey {
  at: number;
  /** Share of the grain pool in the air. 0 = the shipped, pre-air look. */
  air: number;
  /** Share of the closed vista drift. 0 = a still horizon. */
  vista: number;
  /** Added to the effort-derived warmth, clamped into 0..1. */
  warmthBias: number;
  /** The authored chapter this version belongs to. */
  chapter: string;
}

/**
 * Chapter boundaries come from the authored 45s sequence, converted to progress
 * with `sequenceProgress` (0.065 + 0.87·s/45): 9s → 0.239, 21s → 0.471,
 * 29s → 0.626. Keeping the same stations is what makes the production ride feel
 * like the piece, instead of like a second, different edit of it.
 */
export const CLOUD_ATMOSPHERE_KEYS: readonly CloudAtmosphereKey[] = [
  { at: 0.0, air: 0, vista: 0, warmthBias: 0, chapter: "Above the clouds" },
  { at: 0.065, air: 0, vista: 0, warmthBias: 0, chapter: "Above the clouds" },
  { at: 0.239, air: 0.3, vista: 0.1, warmthBias: -0.05, chapter: "The cloud cathedral" },
  { at: 0.471, air: 0.75, vista: 0.45, warmthBias: 0.12, chapter: "Into the light" },
  { at: 0.626, air: 1, vista: 1, warmthBias: 0.2, chapter: "One road. Open sky." },
  { at: 1.0, air: 1, vista: 1, warmthBias: 0.2, chapter: "One road. Open sky." },
] as const;

export interface CloudAtmosphere {
  air: AirDensity;
  vista: number;
  warmthBias: number;
  chapter: string;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** Smootherstep — zero velocity at both ends, so chapters join without a tick. */
function smootherStep(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** The atmosphere at this route progress. */
export function cloudAtmosphere(progress: number): CloudAtmosphere {
  // NaN is "no answer yet" and means the opening version; a past-the-end
  // progress (a clamped curve, an Infinity guard upstream) means the last one.
  const p = Number.isNaN(progress) ? 0 : Math.max(0, Math.min(1, progress));
  const keys = CLOUD_ATMOSPHERE_KEYS;

  // Before the first key, and after the last: hold.
  if (p <= keys[0].at) return version(keys[0]);
  const last = keys[keys.length - 1];
  if (p >= last.at) return version(last);

  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (p < a.at || p > b.at) continue;
    const span = b.at - a.at;
    const t = span > 0 ? smootherStep((p - a.at) / span) : 0;
    return {
      air: a.air + (b.air - a.air) * t,
      vista: a.vista + (b.vista - a.vista) * t,
      warmthBias: a.warmthBias + (b.warmthBias - a.warmthBias) * t,
      // The chapter changes at its boundary, not halfway through the blend: a
      // label that fades is a label you cannot trust.
      chapter: a.chapter,
    };
  }
  return version(last);
}

function version(key: CloudAtmosphereKey): CloudAtmosphere {
  return { air: key.air, vista: key.vista, warmthBias: key.warmthBias, chapter: key.chapter };
}

/** The chapter name at this progress — for the HUD and for the harness. */
export function cloudChapter(progress: number): string {
  return cloudAtmosphere(progress).chapter;
}

/** Warmth the scene should use: the authored reveal, effort on top, clamped. */
export function cloudWarmth(progress: number, effort: number, base: number, effortGain: number): number {
  return clamp01(base + clamp01(effort) * effortGain + cloudAtmosphere(progress).warmthBias);
}
