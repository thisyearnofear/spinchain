/**
 * Sun shafts — the light a canopy lets through, as world data.
 *
 * A place declares `ambient.shafts` and the renderer draws beams where the
 * canopy is open. Nothing here is per-frame: the layout is built once from the
 * route curve, and only a uniform changes while riding, because light does not
 * travel with the rider.
 *
 * Two decisions worth keeping:
 *
 *  - The beam axis comes from the world's own key light (`lighting.keyDirection`),
 *    not from a constant. Light that does not agree with the sun the road is lit
 *    by is the tell that shafts were pasted on.
 *  - Bases are sampled on the skirt surface rather than at a flat height, so a
 *    beam lands on the hillside it comes down onto instead of sinking into it.
 */

import type { CatmullRomCurve3 } from "three";
import { Vector3 } from "three";
import { SKIRT_STEPS, skirtSurfacePoint } from "../route/route-skirt";

export interface ShaftDeclaration {
  /** How many beams along the whole route. The tier caps how many draw. */
  count: number;
  /** Warm light colour at the canopy end. */
  color: string;
  /** Beam length in world units — canopy height above the floor. */
  height: number;
  /** Half-width at the floor. Beams taper to a fifth of it at the canopy. */
  width: number;
  /** 0..1 how hard they read. */
  intensity: number;
}

export interface ShaftLayout {
  count: number;
  /** xyz base on the ground, per shaft. */
  bases: Float32Array;
  widths: Float32Array;
  heights: Float32Array;
  alphas: Float32Array;
  seeds: Float32Array;
  /** Route fraction each beam stands at, so callers can reason about spread. */
  stations: Float32Array;
}

/** Where beams land: close enough to cross the road, not on the rider. */
export const SHAFT_BAND = { inner: 4, outer: 26 } as const;

/** Beams are soft light: a handful reads as a canopy, a crowd reads as fog. */
export const SHAFT_COUNTS = { high: 30, medium: 18, low: 10 } as const;

/** The rider group sits this far below the curve (matches the [0,-10,0] offset). */
export const SHAFT_Y_OFFSET = -10;

/** Direction of the sun when a world declares no lighting of its own. */
export const SHAFT_DEFAULT_KEY_DIRECTION = [0.38, 0.78, 0.5] as const;

/** Golden-ratio stride: even coverage of the route without lining up. */
const STATION_STRIDE = 0.6180339887;

/** Deterministic 0..1 from a sample index — the layout must be seekable. */
export function shaftRandom(index: number, salt: number): number {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function shaftCount(declared: number | undefined, tier: "high" | "medium" | "low"): number {
  const wanted = Math.max(0, Math.floor(declared ?? 0));
  return Math.min(wanted, SHAFT_COUNTS[tier]);
}

const FALLBACK_AXIS = ((): [number, number, number] => {
  const [x, y, z] = SHAFT_DEFAULT_KEY_DIRECTION;
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
})();

/**
 * Unit vector pointing from the floor toward the sun — the direction a beam
 * runs. Takes the world's key light, and falls back to a standing sun when a
 * world has no lighting block or a degenerate direction.
 */
export function shaftAxis(
  keyDirection?: readonly [number, number, number],
): [number, number, number] {
  const raw = keyDirection ?? SHAFT_DEFAULT_KEY_DIRECTION;
  const [x, rawY, z] = raw;
  if (![x, rawY, z].every((value) => Number.isFinite(value))) return FALLBACK_AXIS;
  // A zero direction is a world that meant to declare nothing.
  if (x === 0 && rawY === 0 && z === 0) return FALLBACK_AXIS;
  // Light leaves the sun, so a beam rises along it: the shaft leans away from
  // where its light comes from. The floor keeps beams steep — a sun on the
  // horizon gives horizontal shafts, which reads as lens flare, not canopy.
  const y = Math.max(0.45, Math.abs(rawY));
  const length = Math.hypot(x, y, z);
  if (length < 1e-6) return FALLBACK_AXIS;
  return [x / length, y / length, z / length];
}

/**
 * Build the beam field once. `u` advances by a golden-ratio stride so two
 * neighbouring beams never share a spacing a rider could count.
 */
export function buildShaftLayout(opts: {
  curve: CatmullRomCurve3;
  count: number;
  halfWidth: number;
  height: number;
  width: number;
  /** Ground drop at the skirt edge, in the world's own units. */
  edgeDrop?: number;
}): ShaftLayout {
  const { curve, count, halfWidth, height, width, edgeDrop } = opts;
  const total = Math.max(0, Math.floor(count));
  const layout: ShaftLayout = {
    count: total,
    bases: new Float32Array(total * 3),
    widths: new Float32Array(total),
    heights: new Float32Array(total),
    alphas: new Float32Array(total),
    seeds: new Float32Array(total),
    stations: new Float32Array(total),
  };
  if (total === 0) return layout;

  const frames = curve.computeFrenetFrames(SKIRT_STEPS, true);
  const point = new Vector3();
  const span = SHAFT_BAND.outer - SHAFT_BAND.inner;

  for (let i = 0; i < total; i++) {
    const u = (i * STATION_STRIDE + shaftRandom(i, 1) * 0.04) % 1;
    // Alternating sides keep the road's two edges lit rather than one.
    const side = i % 2 === 0 ? 1 : -1;
    const lateral = side * (SHAFT_BAND.inner + shaftRandom(i, 2) * span);

    layout.stations[i] = u;
    skirtSurfacePoint(curve, frames, SKIRT_STEPS, u, lateral, halfWidth, point, edgeDrop);
    layout.bases[i * 3] = point.x;
    layout.bases[i * 3 + 1] = point.y + SHAFT_Y_OFFSET;
    layout.bases[i * 3 + 2] = point.z;

    // Variation per beam: a canopy is not a lighting rig. Widths and reaches
    // spread around the declared size, never past double it.
    layout.widths[i] = width * (0.55 + shaftRandom(i, 3) * 0.9);
    layout.heights[i] = height * (0.7 + shaftRandom(i, 4) * 0.7);
    layout.alphas[i] = 0.35 + shaftRandom(i, 5) * 0.65;
    layout.seeds[i] = shaftRandom(i, 6);
  }

  return layout;
}

/** Depth window a beam is visible in — close fade stops a full-screen wash. */
export const SHAFT_NEAR_IN = 4;
export const SHAFT_NEAR_OUT = 18;
export const SHAFT_FAR_IN = 90;
export const SHAFT_FAR_OUT = 170;
