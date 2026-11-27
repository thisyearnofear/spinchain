import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  LENS_KEY_STEP,
  LENS_MAX_FOV_DEG,
  clampLensWidth,
  lensAnchorRadiusSq,
  lensCurve,
  lensDollyFactor,
  lensFov,
  lensKeyTarget,
  lensMaxRadiusSq,
  lensSampleRadius,
  lensSpread,
  lensSubjectVisibleHeight,
  pushLensTarget,
  stepLensWidth,
  wheelToLensWidth,
} from "../ride-lens";

const DEG = Math.PI / 180;

/** What the renderer actually does, in the order it does it. */
function renderedSubjectHeight(baseFovDeg: number, distance: number, width: number): number {
  const dollyDistance = distance * lensDollyFactor(width);
  const halfTan = Math.tan((lensFov(baseFovDeg, width) * DEG) / 2);
  const magnification = 1 + lensCurve(width);
  return (2 * dollyDistance * halfTan) / magnification;
}

describe("dolly zoom", () => {
  // The one property that makes this read as a lens instead of a zoom: the
  // rider holds its screen size while the world's parallax changes. If any of
  // spread / capture tangent / curve drifts, this fails.
  it("holds the rider's visible height across the whole width range", () => {
    const baseFov = 60;
    const distance = 17.5;
    const atRest = 2 * distance * Math.tan((baseFov * DEG) / 2);
    for (const width of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      expect(renderedSubjectHeight(baseFov, distance, width)).toBeCloseTo(atRest, 10);
      expect(lensSubjectVisibleHeight(baseFov, distance, width)).toBeCloseTo(atRest, 10);
    }
  });

  it("still holds on the wide preview lens", () => {
    const atRest = lensSubjectVisibleHeight(68, 22, 0);
    expect(lensSubjectVisibleHeight(68, 22, 1)).toBeCloseTo(atRest, 10);
    expect(renderedSubjectHeight(68, 22, 1)).toBeCloseTo(atRest, 10);
  });

  it("pulls the camera closer and opens the lens together", () => {
    for (const width of [0.25, 0.5, 1]) {
      expect(lensSpread(width)).toBeGreaterThan(1);
      expect(lensDollyFactor(width)).toBeCloseTo(1 / lensSpread(width), 12);
      expect(lensDollyFactor(width)).toBeLessThan(1);
    }
  });

  it("is the identity at rest", () => {
    expect(lensSpread(0)).toBe(1);
    expect(lensCurve(0)).toBe(0);
    expect(lensFov(60, 0)).toBeCloseTo(60, 12);
    expect(lensFov(68, 0)).toBeCloseTo(68, 12);
  });

  it("widens monotonically and stays under the safety clamp", () => {
    let previous = 0;
    for (const width of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
      const fov = lensFov(60, width);
      expect(fov).toBeGreaterThanOrEqual(previous);
      expect(fov).toBeLessThan(LENS_MAX_FOV_DEG);
      previous = fov;
    }
  });

  it("clamps nonsense widths to the rest lens", () => {
    for (const width of [Number.NaN, Number.POSITIVE_INFINITY, -3]) {
      expect(clampLensWidth(width)).toBe(0);
      expect(lensFov(60, width)).toBeCloseTo(60, 12);
    }
    expect(clampLensWidth(2.5)).toBe(1);
  });
});

describe("barrel warp", () => {
  // Both ends are fixed points, which is what keeps the distortion edge-to-edge
  // with no black border and no clamp smear.
  it("pins the centre and the furthest corner", () => {
    for (const curve of [0, lensCurve(0.25), lensCurve(0.5), lensCurve(1)]) {
      expect(lensSampleRadius(0, curve)).toBe(0);
      expect(lensSampleRadius(1, curve)).toBe(1);
    }
  });

  it("bows inward between the ends, growing with the curve", () => {
    const half = lensSampleRadius(0.5, lensCurve(1));
    expect(half).toBeLessThan(0.5);
    expect(lensSampleRadius(0.5, lensCurve(0.5))).toBeGreaterThan(half);
    expect(lensSampleRadius(0.5, 0)).toBeCloseTo(0.5, 12);
  });

  it("normalises the radial falloff to the furthest corner", () => {
    const aspect = 16 / 9;
    // Centred: the normalised radius of the furthest corner is exactly 1.
    expect(lensAnchorRadiusSq(0.5, 0.5, aspect) / lensMaxRadiusSq(0.5, 0.5, aspect)).toBeCloseTo(1, 12);
    // Off-centre: no point in the frame can exceed the corner radius.
    for (const [x, y] of [[0.2, 0.8], [0.9, 0.1], [0.5, 0.5]]) {
      const max = lensMaxRadiusSq(x, y, aspect);
      for (const [px, py] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
        expect(lensAnchorRadiusSq(px - x, py - y, aspect)).toBeLessThanOrEqual(max + 1e-12);
      }
    }
  });
});

describe("width control", () => {
  it("converts lines and pages to the same pixel travel", () => {
    const px = wheelToLensWidth(100, 0, 900);
    expect(wheelToLensWidth(100 / 16, 1, 900)).toBeCloseTo(px, 12);
    expect(wheelToLensWidth(100 / 900, 2, 900)).toBeCloseTo(px, 12);
  });

  it("ignores non-events and falls back on a bogus page height", () => {
    expect(wheelToLensWidth(0, 0, 900)).toBe(0);
    expect(wheelToLensWidth(Number.NaN, 0, 900)).toBe(0);
    expect(wheelToLensWidth(1, 2, 0)).toBeCloseTo(800 / 620, 12);
  });

  it("gives the keyboard the same control", () => {
    expect(lensKeyTarget("BracketRight", 0)).toBeCloseTo(LENS_KEY_STEP, 12);
    expect(lensKeyTarget("BracketLeft", LENS_KEY_STEP)).toBeCloseTo(0, 12);
    expect(lensKeyTarget("BracketRight", 1)).toBe(1);
    expect(lensKeyTarget("BracketLeft", 0)).toBe(0);
    expect(lensKeyTarget("Backslash", 0.8)).toBe(0);
    for (const code of ["KeyH", "KeyV", "ArrowUp", "Escape"]) {
      expect(lensKeyTarget(code, 0.5)).toBeNull();
    }
  });

  it("eases on elapsed time, not on frame count", () => {
    const oneBigStep = stepLensWidth(0, 1, 1 / 30);
    const twoSmallSteps = stepLensWidth(stepLensWidth(0, 1, 1 / 60), 1, 1 / 60);
    expect(twoSmallSteps).toBeCloseTo(oneBigStep, 12);
  });

  it("never overshoots and settles exactly on the target", () => {
    let width = 0;
    for (let frame = 0; frame < 600; frame++) {
      const next = stepLensWidth(width, 1, 1 / 60);
      expect(next).toBeGreaterThanOrEqual(width);
      expect(next).toBeLessThanOrEqual(1);
      width = next;
    }
    expect(width).toBe(1);
    expect(stepLensWidth(0.4, 0.4, 1 / 60)).toBe(0.4);
  });

  it("cannot drift: scrolling back to zero restores the shipped lens", () => {
    let target = 0;
    // A hundred small wheel events accumulate in the target, not the camera.
    for (let event = 0; event < 100; event++) {
      target = pushLensTarget(target, wheelToLensWidth(6, 0, 900));
    }
    expect(target).toBeGreaterThan(0.5);
    for (let event = 0; event < 100; event++) {
      target = pushLensTarget(target, -wheelToLensWidth(6, 0, 900));
    }
    // Exactly zero, not float dust: sub-epsilon residue would keep the warp
    // pass (and the dolly) awake forever instead of letting them early-out.
    expect(target).toBe(0);
    expect(lensFov(60, target)).toBeCloseTo(60, 12);
    expect(lensCurve(target)).toBe(0);
  });

  it("holds still for a zero or negative frame delta", () => {
    expect(stepLensWidth(0.3, 1, 0)).toBe(0.3);
    expect(stepLensWidth(0.3, 1, -1)).toBe(0.3);
    expect(stepLensWidth(0.3, 1, Number.NaN)).toBe(0.3);
  });
});

/**
 * The camera half, measured through three's own projection matrix rather than
 * restated algebra: dolly toward the rider, then open the lens. What the
 * renderer gets is a subject that is (1 + curve) times smaller on screen — and
 * that is exactly the magnification the warp pass multiplies back, which is why
 * `renderer + warp` is the invariant the unit tests above assert.
 *
 * The rig mirrors the ride's chase camera: behind and above the rider, looking
 * slightly above them, so the rider sits below centre as they do in the frame.
 */
describe("camera dolly (through three's projection)", () => {
  function rig(width: number) {
    const cam = new PerspectiveCamera(60, 16 / 9, 0.1, 2000);
    const rider = new Vector3(0, 0, 0);
    cam.position.set(0, 6.5, -10);
    cam.lookAt(new Vector3(0, 1.2, 0));
    cam.updateMatrixWorld();

    // Exactly what the frame loop does.
    cam.position.lerpVectors(cam.position, rider, 1 - lensDollyFactor(width));
    cam.fov = lensFov(60, width);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    const project = (p: Vector3) => p.clone().project(cam);
    return {
      centre: project(rider),
      top: project(new Vector3(0, 0.5, 0)),
      bottom: project(new Vector3(0, -0.5, 0)),
      distance: cam.position.distanceTo(rider),
    };
  }

  it("dollies by exactly the spread", () => {
    const rest = rig(0);
    for (const width of [0.25, 0.5, 0.75, 1]) {
      expect(rig(width).distance).toBeCloseTo(rest.distance * lensDollyFactor(width), 9);
    }
  });

  it("leaves the rider (1 + curve) smaller on screen — the amount the warp magnifies back", () => {
    const rest = rig(0);
    const restSize = rest.top.y - rest.bottom.y;
    for (const width of [0.25, 0.5, 0.75, 1]) {
      const r = rig(width);
      const size = r.top.y - r.bottom.y;
      // Within half a percent: the remainder is the rider sitting slightly off
      // the view axis, which no lens can cancel exactly.
      expect(size / restSize).toBeCloseTo(1 / (1 + lensCurve(width)), 2);
    }
  });

  it("keeps the rider on the frame, moving only toward the centre as the lens widens", () => {
    const rest = rig(0);
    for (const width of [0.25, 0.5, 0.75, 1]) {
      const r = rig(width);
      expect(Math.abs(r.centre.x)).toBeLessThan(1e-9);
      // Off-axis content converges toward the middle with a wide lens; it must
      // never cross the centre or leave the frame.
      expect(r.centre.y).toBeGreaterThan(rest.centre.y);
      expect(r.centre.y).toBeLessThan(0);
    }
  });

  it("is the identity at rest", () => {
    const rest = rig(0);
    const plain = new PerspectiveCamera(60, 16 / 9, 0.1, 2000);
    plain.position.set(0, 6.5, -10);
    plain.lookAt(new Vector3(0, 1.2, 0));
    plain.updateMatrixWorld();
    expect(rest.centre.x).toBeCloseTo(plain.position.clone().project(plain).x, 9);
    expect(rest.distance).toBeCloseTo(Math.hypot(6.5, 10), 9);
  });
});
