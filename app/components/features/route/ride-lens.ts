/**
 * Ride lens — the rider-locked fisheye dolly zoom.
 *
 * A dolly zoom reads as a *lens* change rather than a zoom only if the
 * subject keeps its screen size while the background's parallax changes. Three
 * numbers have to move together to hold that:
 *
 *   spread   = 1 + 0.72w   the camera dollies this much closer to the rider
 *   tanHalf *= spread      the lens opens by exactly the same factor
 *   curve    = 0.30w²      the warp magnifies the centre by (1 + curve), so
 *                          the capture tangent is overscanned by (1 + curve)
 *                          to cancel it again
 *
 * Get one of them out of step and the rider visibly grows or shrinks — the one
 * failure that reads as a bug rather than a lens. Every constant here is fixed
 * by that invariant, and `lensSubjectVisibleHeight` composes the same functions
 * the renderer uses so the test can assert the property instead of restating
 * the algebra.
 *
 * Width is a *control* (0..1), not a camera value: the wheel, the keyboard and
 * any future pinch all push one target, and one eased width drives both the
 * camera and the warp pass. At 0 the pass early-outs and the camera dolly is
 * the identity, so the shipped look is untouched.
 */

/** Camera dolly gain: how much closer the lens pulls the camera at full width. */
export const LENS_SPREAD_GAIN = 0.72;
/** Distortion gain. Quadratic in width so the barrel stays subtle early on. */
export const LENS_CURVE_GAIN = 0.3;
/**
 * Safety clamp only. At the base lenses this app uses (60° chase, 68° preview)
 * full width lands near 112°, so this never engages — it exists so a future
 * wide base lens cannot blow tan() up instead of degrading gracefully.
 */
export const LENS_MAX_FOV_DEG = 150;
/** Ease rate toward the target, per second. */
export const LENS_EASE_RATE = 6;
/** One keyboard step, as a fraction of full width. */
export const LENS_KEY_STEP = 0.12;
/** Wheel `deltaMode: DOM_DELTA_LINE` is in lines — one notch is ~16px. */
export const LENS_WHEEL_LINE_PX = 16;
/** Pixels of wheel travel for the full 0..1 sweep. */
export const LENS_WHEEL_TRAVEL_PX = 620;
/** Widths below this are treated as "off" — the pass is a straight copy. */
export const LENS_EPSILON = 1e-3;

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/** One frame of lens state, shared from the camera loop to the post pass. */
export interface RideLensFrame {
  /** Eased width, 0..1. */
  width: number;
  /** Anchor in normalised frame space (0..1, origin bottom-left) — the rider. */
  anchorX: number;
  anchorY: number;
}

export function clampLensWidth(width: number): number {
  if (!Number.isFinite(width)) return 0;
  return Math.max(0, Math.min(1, width));
}

/** How much the camera dollies toward the rider at this width. */
export function lensSpread(width: number): number {
  return 1 + LENS_SPREAD_GAIN * clampLensWidth(width);
}

/** Barrel strength. Quadratic: the first third of the slider stays nearly flat. */
export function lensCurve(width: number): number {
  const w = clampLensWidth(width);
  return LENS_CURVE_GAIN * w * w;
}

/** Camera-to-rider offset multiplier — the dolly itself. */
export function lensDollyFactor(width: number): number {
  return 1 / lensSpread(width);
}

/**
 * `tan(halfFov)` for the widened lens. `spread` holds the subject's size;
 * `1 + curve` overscans for the centre magnification the warp adds back.
 */
export function lensCaptureTan(halfTan: number, width: number): number {
  return halfTan * lensSpread(width) * (1 + lensCurve(width));
}

/** Vertical field of view (degrees) for the widened lens, given the normal one. */
export function lensFov(baseFovDeg: number, width: number): number {
  const halfTan = Math.tan((baseFovDeg * DEG_TO_RAD) / 2);
  const widened = 2 * Math.atan(lensCaptureTan(halfTan, width)) * RAD_TO_DEG;
  return Math.min(LENS_MAX_FOV_DEG, widened);
}

/**
 * Output radius → input radius for the warp, in frame units.
 *
 * Fixed points at both ends: 0 maps to 0 and 1 maps to 1, so the centre stays
 * put and the furthest corner samples itself. That is what keeps the distortion
 * edge-to-edge with no black border and no clamping artefacts — every radius
 * between just bows inward.
 */
export function lensSampleRadius(radius: number, curve: number): number {
  return (radius * (1 + curve * radius * radius)) / (1 + curve);
}

/**
 * Visible world height at the subject through the whole chain: dolly, then the
 * overscanned capture, then the warp's centre magnification. This is the thing
 * that must not change with width.
 */
export function lensSubjectVisibleHeight(
  baseFovDeg: number,
  distance: number,
  width: number,
): number {
  const halfTan = Math.tan((baseFovDeg * DEG_TO_RAD) / 2);
  const dolly = distance * lensDollyFactor(width);
  const magnification = 1 + lensCurve(width);
  return (2 * dolly * lensCaptureTan(halfTan, width)) / magnification;
}

/** Squared aspect-corrected distance from the anchor — the warp's radial term. */
export function lensAnchorRadiusSq(dx: number, dy: number, aspect: number): number {
  const x = dx * aspect;
  return x * x + dy * dy;
}

/**
 * Squared radius of the furthest frame corner from the anchor. Separable
 * because the frame is axis-aligned, so one max per axis is exact.
 */
export function lensMaxRadiusSq(anchorX: number, anchorY: number, aspect: number): number {
  const x = Math.max(Math.abs(anchorX), Math.abs(1 - anchorX)) * aspect;
  const y = Math.max(Math.abs(anchorY), Math.abs(1 - anchorY));
  return Math.max(1e-4, x * x + y * y);
}

/**
 * Wheel delta → width delta. Lines and pages are converted to pixels first so
 * a notched mouse and a trackpad travel the same distance for the same intent.
 */
export function wheelToLensWidth(
  deltaY: number,
  deltaMode: number,
  pageHeight: number,
): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return 0;
  let px = deltaY;
  if (deltaMode === 1) px = deltaY * LENS_WHEEL_LINE_PX;
  else if (deltaMode === 2) {
    px = deltaY * (Number.isFinite(pageHeight) && pageHeight > 0 ? pageHeight : 800);
  }
  return px / LENS_WHEEL_TRAVEL_PX;
}

/**
 * Keyboard → new target width, or null for "not a lens key".
 * Bracket keys because the ride already owns arrows, WASD, H, C, V and Esc.
 */
export function lensKeyTarget(code: string, target: number): number | null {
  switch (code) {
    case "BracketRight":
      return pushLensTarget(target, LENS_KEY_STEP);
    case "BracketLeft":
      return pushLensTarget(target, -LENS_KEY_STEP);
    case "Backslash":
      return 0;
    default:
      return null;
  }
}

/**
 * Apply a control delta to the target, snapping sub-epsilon residue back to the
 * rest lens. Without the snap, a long scroll out and back leaves ~1e-17 of
 * float dust in the target: harmless to look at, but it keeps the warp pass
 * (and the dolly) alive instead of letting them early-out.
 */
export function pushLensTarget(target: number, delta: number): number {
  const next = clampLensWidth(clampLensWidth(target) + delta);
  return next < LENS_EPSILON ? 0 : next;
}

/**
 * Ease toward the target on elapsed time, never on per-frame accumulation —
 * the same reason the ride's travel is integrated rather than stepped. A
 * dropped frame changes when the lens arrives, not where it lands.
 */
export function stepLensWidth(
  current: number,
  target: number,
  deltaSeconds: number,
): number {
  const from = clampLensWidth(current);
  const to = clampLensWidth(target);
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return from;
  const k = 1 - Math.exp(-LENS_EASE_RATE * deltaSeconds);
  const next = from + (to - from) * k;
  // Settle exactly on the target so a parked lens stops uploading uniforms.
  return Math.abs(to - next) < LENS_EPSILON ? to : next;
}
