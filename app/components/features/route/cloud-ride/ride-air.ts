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

/** World size for a grain: mostly tiny, a few recognizable seeds. */
export function airGrainSize(seed: number): number {
  const r = positiveMod(seed * 7.31 + 0.17, 1);
  // Sized for our chase distance (~12 units from the rider): the reference's
  // 0.03–0.10 would land at two pixels, which reads as sensor dust, not pollen.
  return r < 0.86 ? 0.045 + r * 0.075 : 0.17 + (r - 0.86) * 0.75;
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
