/**
 * Vista loop — the closed, camera-relative drift of the far landscape.
 *
 * A finite vista asked to sit still reads as a photograph, and one asked to
 * travel reads as a treadmill that eventually runs out. The answer is a small
 * closed loop: the far banks orbit on a slow ellipse whose position *and*
 * velocity match across the seam, so 140 seconds in it passes through its
 * start without a visible step.
 *
 * The two axes are deliberately unequal. Lateral motion is a short 1.2-unit
 * sweep; depth is 12. Because screen speed goes as 1/depth, the same numbers
 * that barely move a bank at 200 units would tear the horizon if applied to
 * anything near — which is the whole point of parallax, and why the far layer
 * is the only thing this drives.
 */

/** Loop period in seconds. */
export const VISTA_PERIOD_S = 140;
/** Lateral half-excursion, world units. */
export const VISTA_LATERAL = 1.2;
/** Depth half-excursion, world units. */
export const VISTA_DEPTH = 12;

import { positiveMod } from "./ride-air";

export interface VistaOffset {
  x: number;
  z: number;
}

/**
 * Camera-relative offset for the far layer at `seconds`.
 *
 * x = lateral * (1 − cos a), z = depth * sin a, a = 2π (t % period) / period.
 * Chosen so the *velocity* is continuous too: at the seam both components come
 * back to their starting value with the same slope, which is what stops the
 * loop from ticking. A sawtooth in either would show.
 */
export function vistaOffset(
  seconds: number,
  lateral = VISTA_LATERAL,
  depth = VISTA_DEPTH,
  period = VISTA_PERIOD_S,
): VistaOffset {
  if (!Number.isFinite(seconds) || period <= 0) return { x: 0, z: 0 };
  const angle = (2 * Math.PI * (positiveMod(seconds, period) || 0)) / period;
  return {
    x: lateral * (1 - Math.cos(angle)),
    z: depth * Math.sin(angle),
  };
}

/** Analytic velocity, for tests and for anything that needs to lead the loop. */
export function vistaVelocity(
  seconds: number,
  lateral = VISTA_LATERAL,
  depth = VISTA_DEPTH,
  period = VISTA_PERIOD_S,
): VistaOffset {
  if (!Number.isFinite(seconds) || period <= 0) return { x: 0, z: 0 };
  const angle = (2 * Math.PI * (positiveMod(seconds, period) || 0)) / period;
  const w = (2 * Math.PI) / period;
  return {
    x: lateral * Math.sin(angle) * w,
    z: depth * Math.cos(angle) * w,
  };
}
