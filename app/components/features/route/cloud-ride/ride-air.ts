/**
 * Ride air — the windborne grain field the rider travels through.
 *
 * A fixed pool of quads, seeded once, living in a bounded corridor that is
 * *stationed on the route* rather than animated on a timer: a grain's position
 * is `mod(seed − travel, span) − far`, so
 *
 *   - travel is the same cumulative station the road, the wheels and the camera
 *     read, so the air can never drift out of step with the ground it is over;
 *   - the pool never grows — grains are returned to the far end of the corridor
 *     rather than recycled through allocation;
 *   - the wrap is a pure function of one number, so a seek or a camera cut needs
 *     no history rebuild (that is why this field has no motion-streak buffer:
 *     streaks need the previous frame's projection, and a harness seek would
 *     smear one frame across the cut. Size and depth fade carry the speed
 *     instead).
 *
 * The two fades are separate on purpose. The *field* fade hides the wrap itself
 * — a grain must not appear or vanish inside the corridor. The *camera-depth*
 * fade handles very near grain (which would read as a floating blob) and very
 * distant grain (which would alias into noise). Confusing the two is what makes
 * particle volumes pop.
 */

/** Corridor length in world units — one full cycle of the pool. */
export const AIR_SPAN = 34;
/** How far behind the rider grain still exists. */
export const AIR_FAR = 24;
/** Depth range the pool covers ahead of the rider: span − far. */
export const AIR_AHEAD = AIR_SPAN - AIR_FAR;

/** Camera-depth fade, in units from the lens (both ends are invisible). */
export const AIR_DEPTH_IN = 0.72;
export const AIR_DEPTH_FULL_IN = 2.15;
export const AIR_DEPTH_FULL_OUT = 15;
export const AIR_DEPTH_OUT = 23;

/** Field fade lengths: the respawn edge is longer than the trailing edge. */
export const AIR_FIELD_IN_SPAN = 7;
export const AIR_FIELD_OUT_SPAN = 4;

/** True modulo. `%` in JS and GLSL keeps the sign of the dividend. */
export function positiveMod(value: number, span: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(span) || span <= 0) return 0;
  return ((value % span) + span) % span;
}

/** Hermite ramp, clamped — the same shape the shader uses. */
export function smoothStep(edge0: number, edge1: number, x: number): number {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * A grain's station in rider-relative units: negative is behind, positive is
 * ahead, bounded by [−far, span − far].
 */
export function airStation(
  seed: number,
  travel: number,
  flutter = 0,
  span = AIR_SPAN,
  far = AIR_FAR,
): number {
  return positiveMod(seed * span - travel + flutter, span) - far;
}

/**
 * How many times this grain has wrapped. The sideways offset is re-drawn from
 * it, which is what keeps the respawn edge from reading as a line of grain all
 * appearing in the same place.
 */
export function airWrapCount(seed: number, travel: number, span = AIR_SPAN): number {
  return Math.floor((seed * span - travel) / span);
}

/** Sideways offset for a grain, re-drawn every wrap (golden-ratio shuffle). */
export function airLateral(seed: number, lateralSeed: number, wrap: number): number {
  return (positiveMod(lateralSeed + wrap * 0.6180339887498949 + seed, 1) - 0.5) * 2;
}

/**
 * Field fade: zero at both ends of the corridor, one across the middle. The
 * respawn edge ramps over a longer distance than the trailing edge because the
 * respawn sits ahead of the rider, in view.
 */
export function airFieldFade(
  station: number,
  span = AIR_SPAN,
  far = AIR_FAR,
  inSpan = AIR_FIELD_IN_SPAN,
  outSpan = AIR_FIELD_OUT_SPAN,
): number {
  const ahead = span - far;
  // Ramp up off the trailing edge, hold across the middle, ramp out before the
  // respawn edge. Multiplying the two keeps exactly one plateau.
  return (
    smoothStep(-far, -far + outSpan, station) *
    (1 - smoothStep(ahead - inSpan, ahead, station))
  );
}

/**
 * Camera-depth fade — invisible closer than `AIR_DEPTH_IN`, at full strength
 * between the full-in and full-out planes, gone past `AIR_DEPTH_OUT`.
 */
export function airVisibility(
  depth: number,
  dIn = AIR_DEPTH_IN,
  dFullIn = AIR_DEPTH_FULL_IN,
  dFullOut = AIR_DEPTH_FULL_OUT,
  dOut = AIR_DEPTH_OUT,
): number {
  if (!Number.isFinite(depth)) return 0;
  return smoothStep(dIn, dFullIn, depth) * (1 - smoothStep(dFullOut, dOut, depth));
}

/** Combined opacity for a grain at this station and camera depth. */
export function airOpacity(
  station: number,
  depth: number,
  span = AIR_SPAN,
  far = AIR_FAR,
): number {
  return airFieldFade(station, span, far) * airVisibility(depth);
}

/**
 * Apparent size in pixels — the second speed cue after the fade. A grain's
 * screen size is its world size over its depth, so the same pool reads as dust
 * ahead and as a passing fleck beside the lens without any extra geometry.
 */
export function airScreenSize(worldSize: number, depth: number, fovTan: number, viewportHeight: number): number {
  if (!Number.isFinite(depth) || depth <= 0) return 0;
  return (worldSize * viewportHeight) / (2 * depth * fovTan);
}

/** World size for a kind at a seed — within the kind's authored range. */
export function airKindSize(profile: AirKindProfile, seed: number): number {
  const [min, max] = profile.size;
  const r = positiveMod(seed * 7.31 + 0.17, 1);
  // Mostly towards the small end, with a few larger ones, as grain should be.
  return min + (max - min) * r * r;
}

/** World size for a grain: mostly tiny, a few recognizable seeds. */
export function airGrainSize(seed: number): number {
  const r = positiveMod(seed * 7.31 + 0.17, 1);
  // Sized for our chase distance (~12 units from the rider): the reference's
  // 0.03–0.10 would land at two pixels, which reads as sensor dust, not pollen.
  return r < 0.86 ? 0.045 + r * 0.075 : 0.17 + (r - 0.86) * 0.75;
}

/**
 * What a world puts in its air. A world *declares* one of these
 * (`WorldAmbient.particles.kind`) and the field draws it — leaves tumbling in a
 * woodland, rain streaking past in a storm, embers drifting up off a fire.
 * Same pool, same one draw call, same fades; only the character changes.
 */
export type AirKind = "dust" | "leaf" | "rain" | "snow" | "ember" | "spore";

export interface AirKindProfile {
  /** World size range, tiny to seed. */
  size: [number, number];
  /** Vertical stretch of the billboard — rain is a streak, snow is a flake. */
  stretchY: number;
  /** Radians of spin per unit of travel. Leaves tumble; rain does not. */
  tumble: number;
  /** Lateral sway, world units — the wind's personality. */
  sway: number;
  /**
   * Bounded vertical drift, world units. Not a fall simulation: the altitude
   * wraps with the station, so a leaf hovers down and a spark rises without
   * either leaving the corridor.
   */
  rise: number;
  /** 0..1 — how much of the frame this kind fills. Scales the pool. */
  density: number;
  /** Render as a leaf silhouette rather than a soft round grain. */
  leafShape: boolean;
}

/**
 * The characters. Values are authored per kind rather than derived, because
 * this is the one place the field is allowed to be art rather than physics.
 */
export const AIR_KINDS: Record<AirKind, AirKindProfile> = {
  dust: { size: [0.045, 0.12], stretchY: 1, tumble: 0, sway: 0.25, rise: 0.4, density: 1, leafShape: false },
  // Leaves: fewer than dust, larger, slower, and they turn as they pass.
  leaf: { size: [0.16, 0.34], stretchY: 0.72, tumble: 0.9, sway: 1.6, rise: -0.5, density: 0.62, leafShape: true },
  // Rain: long thin streaks that barely sway, because rain falls straight.
  rain: { size: [0.05, 0.1], stretchY: 6, tumble: 0, sway: 0.1, rise: -3, density: 1, leafShape: false },
  snow: { size: [0.09, 0.2], stretchY: 1, tumble: 0.25, sway: 1.1, rise: -0.8, density: 0.85, leafShape: false },
  // Embers rise, which is the one direction that reads as heat.
  ember: { size: [0.05, 0.13], stretchY: 1.2, tumble: 0.4, sway: 0.6, rise: 1.6, density: 0.55, leafShape: false },
  spore: { size: [0.04, 0.11], stretchY: 1, tumble: 0.15, sway: 1.9, rise: 0.2, density: 0.5, leafShape: false },
};

/** Kind profile by name, falling back to dust rather than throwing. */
export function airKindProfile(kind: string | undefined): AirKindProfile {
  return AIR_KINDS[(kind ?? "dust") as AirKind] ?? AIR_KINDS.dust;
}

/** Pool size for a kind at a tier — a declared world count clamped to the tier. */
export function airKindCount(kind: string | undefined, tier: "high" | "medium" | "low", declared?: number): number {
  const cap = airGrainCount(tier);
  if (cap === 0) return 0;
  const profile = airKindProfile(kind);
  const base = declared && declared > 0 ? declared : cap;
  return Math.max(0, Math.round(Math.min(cap * 1.6, base) * profile.density));
}

/**
 * Pool size per render tier. The authored reference runs 920 on desktop and 425
 * on smaller devices; our corridor is 34 units rather than a full pass, so the
 * same density per unit lands lower. Low tier gets none: a full-frame of
 * transparent quads is the wrong trade on software WebGL.
 */
export function airGrainCount(tier: "high" | "medium" | "low"): number {
  return tier === "high" ? 420 : tier === "medium" ? 240 : 0;
}
