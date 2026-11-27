import { describe, expect, it } from "vitest";
import {
  VISTA_DEPTH,
  VISTA_LATERAL,
  VISTA_PERIOD_S,
  vistaOffset,
  vistaVelocity,
} from "../cloud-ride/vista-loop";

describe("vista loop", () => {
  it("starts at its own origin", () => {
    expect(vistaOffset(0)).toEqual({ x: 0, z: 0 });
  });

  it("passes through the seam with matched position AND velocity", () => {
    const dt = 0.01;
    for (const t of [VISTA_PERIOD_S - dt, 2 * VISTA_PERIOD_S - dt, 7 * VISTA_PERIOD_S - dt]) {
      const left = vistaOffset(t);
      const middle = vistaOffset(t + dt);
      const right = vistaOffset(t + 2 * dt);
      for (const axis of ["x", "z"] as const) {
        const incoming = (middle[axis] - left[axis]) / dt;
        const outgoing = (right[axis] - middle[axis]) / dt;
        expect(Math.abs(incoming - outgoing)).toBeLessThan(0.001);
        expect(incoming).toBeCloseTo(vistaVelocity(t)[axis], 2);
      }
    }
  });

  it("never leaves its excursion", () => {
    for (let t = 0; t < VISTA_PERIOD_S; t += 0.5) {
      const { x, z } = vistaOffset(t);
      expect(x).toBeGreaterThanOrEqual(-1e-12);
      expect(x).toBeLessThanOrEqual(2 * VISTA_LATERAL + 1e-12);
      expect(Math.abs(z)).toBeLessThanOrEqual(VISTA_DEPTH + 1e-12);
    }
  });

  it("is periodic to the last decimal", () => {
    for (const t of [0, 13.7, 61.2, 139.999]) {
      expect(vistaOffset(t + VISTA_PERIOD_S).x).toBeCloseTo(vistaOffset(t).x, 12);
      expect(vistaOffset(t + VISTA_PERIOD_S).z).toBeCloseTo(vistaOffset(t).z, 12);
    }
  });

  it("survives nonsense input without a NaN reaching a transform", () => {
    for (const t of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(vistaOffset(t)).toEqual({ x: 0, z: 0 });
      expect(vistaVelocity(t)).toEqual({ x: 0, z: 0 });
    }
    expect(vistaOffset(5, VISTA_LATERAL, VISTA_DEPTH, 0)).toEqual({ x: 0, z: 0 });
  });

  // The endless-riding invariant: at one focal length, something ten units away
  // crosses the frame ten times faster than something a hundred units away.
  // This is why the loop only ever drives the far layer.
  it("keeps far parallax slow: 1 unit of displacement is 10x the screen motion at 10x the depth", () => {
    const screenSpeed = (depth: number) => 1200 * 0.3 / depth;
    expect(screenSpeed(10) / screenSpeed(100)).toBeCloseTo(10, 9);
    // The far banks sit ~200 units out, so a 12-unit sweep is ~6% of their
    // distance — a drift, not a travel.
    expect(VISTA_DEPTH / 200).toBeLessThan(0.1);
  });
});
