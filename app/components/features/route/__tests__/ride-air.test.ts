import { describe, expect, it } from "vitest";
import {
  AIR_AHEAD,
  AIR_DEPTH_IN,
  AIR_DEPTH_OUT,
  AIR_FAR,
  AIR_SPAN,
  airFieldFade,
  airGrainCount,
  airGrainSize,
  airLateral,
  airOpacity,
  airScreenSize,
  airStation,
  airVisibility,
  airWrapCount,
  positiveMod,
  smoothStep,
} from "../cloud-ride/ride-air";

describe("station wrap", () => {
  it("wraps with a true modulo, not the sign of the dividend", () => {
    expect(positiveMod(5, 34)).toBe(5);
    expect(positiveMod(-5, 34)).toBe(29);
    expect(positiveMod(-39, 34)).toBe(29);
    expect(positiveMod(0, 34)).toBe(0);
    expect(positiveMod(5, 0)).toBe(0);
  });

  it("holds every grain inside the corridor", () => {
    for (let travel = 0; travel < 400; travel += 3.7) {
      for (const seed of [0, 0.13, 0.5, 0.77, 0.999]) {
        const s = airStation(seed, travel);
        expect(s).toBeGreaterThanOrEqual(-AIR_FAR);
        expect(s).toBeLessThan(AIR_AHEAD);
      }
    }
  });

  // The endless-riding property: one period later a grain is exactly where it
  // was, and its velocity has no seam either (a constant derivative through the
  // wrap, so nothing accelerates as it respawns).
  it("returns the same station one period later, at the same velocity", () => {
    const dt = 0.01;
    for (const seed of [0.05, 0.4, 0.92]) {
      const here = airStation(seed, 12.3);
      const later = airStation(seed, 12.3 + AIR_SPAN);
      expect(later).toBeCloseTo(here, 9);

      const before = airStation(seed, AIR_SPAN * 2 - dt);
      const at = airStation(seed, AIR_SPAN * 2);
      const after = airStation(seed, AIR_SPAN * 2 + dt);
      const incoming = (at - before) / dt;
      const outgoing = (after - at) / dt;
      expect(Math.abs(incoming - outgoing)).toBeLessThan(1e-6);
      // And the sweep is exactly travel: one unit of travel is one unit closer.
      expect(incoming).toBeCloseTo(-1, 6);
    }
  });

  it("re-draws the sideways offset on the wrap, once per cycle", () => {
    const seed = 0.31;
    const lateralSeed = 0.62;
    const wrapAt = (travel: number) => airWrapCount(seed, travel);
    const first = wrapAt(0);
    // A grain wraps at its *own* station (seed * span of travel), not at a
    // shared cycle boundary — so sample inside that grain's cycle, then one
    // whole cycle later.
    expect(wrapAt(seed * AIR_SPAN * 0.5)).toBe(first);
    expect(airLateral(seed, lateralSeed, wrapAt(seed * AIR_SPAN * 0.5))).toBeCloseTo(
      airLateral(seed, lateralSeed, first),
      12,
    );
    // One cycle later: a different offset — the respawn edge is never a line.
    const next = wrapAt(seed * AIR_SPAN + AIR_SPAN * 0.5);
    expect(next).not.toBe(first);
    expect(airLateral(seed, lateralSeed, next)).not.toBeCloseTo(
      airLateral(seed, lateralSeed, first),
      3,
    );
  });
});

describe("fades", () => {
  it("hides both ends of the field so the wrap is never seen", () => {
    expect(airFieldFade(-AIR_FAR)).toBe(0);
    expect(airFieldFade(AIR_AHEAD)).toBeCloseTo(0, 12);
    // A plateau across the middle where grain is at full strength.
    expect(airFieldFade(-AIR_FAR + 8)).toBe(1);
    expect(airFieldFade(0)).toBe(1);
    expect(airFieldFade(AIR_AHEAD - 8)).toBe(1);
  });

  it("ramps the field fade monotonically in from the trailing edge", () => {
    let previous = 0;
    for (let s = -AIR_FAR; s <= -AIR_FAR + 5; s += 0.25) {
      const f = airFieldFade(s);
      expect(f).toBeGreaterThanOrEqual(previous);
      previous = f;
    }
  });

  it("fades very near and very distant grain in camera depth", () => {
    expect(airVisibility(AIR_DEPTH_IN)).toBe(0);
    expect(airVisibility(0.2)).toBe(0);
    expect(airVisibility(6)).toBe(1);
    expect(airVisibility(AIR_DEPTH_OUT)).toBe(0);
    expect(airVisibility(60)).toBe(0);
    // Monotone in, monotone out, single peak.
    expect(airVisibility(1.4)).toBeGreaterThan(0);
    expect(airVisibility(1.4)).toBeLessThan(1);
    expect(airVisibility(19)).toBeGreaterThan(0);
    expect(airVisibility(19)).toBeLessThan(1);
  });

  it("pairs the two fades without either masking the other", () => {
    // A grain at mid-corridor but right at the lens: the depth fade wins.
    expect(airOpacity(0, 0.3)).toBe(0);
    // Mid-corridor at a readable depth: fully visible.
    expect(airOpacity(0, 6)).toBe(1);
    // At the respawn edge: the field fade wins even at a good depth.
    expect(airOpacity(AIR_AHEAD, 6)).toBe(0);
  });
});

describe("grain", () => {
  it("is mostly tiny, with a few recognizable seeds", () => {
    let tiny = 0;
    const total = 500;
    for (let i = 0; i < total; i++) {
      const size = airGrainSize(i / total);
      expect(size).toBeGreaterThan(0);
      if (size < 0.16) tiny += 1;
    }
    expect(tiny / total).toBeGreaterThan(0.8);
    expect(tiny / total).toBeLessThan(0.95);
  });

  // The depth ratio the endless-riding skill asserts: at the same focal length
  // something 10 units away crosses the frame ten times faster than something
  // 100 units away.
  it("sizes grain by depth, so near grain crosses faster", () => {
    const near = airScreenSize(0.05, 10, Math.tan((57 * Math.PI) / 360), 720);
    const far = airScreenSize(0.05, 100, Math.tan((57 * Math.PI) / 360), 720);
    expect(near / far).toBeCloseTo(10, 6);
  });

  it("keeps the pool fixed per tier, and off on the low tier", () => {
    expect(airGrainCount("high")).toBe(420);
    expect(airGrainCount("medium")).toBe(240);
    expect(airGrainCount("low")).toBe(0);
  });

  it("has a clamped smootherstep for the shader to match", () => {
    expect(smoothStep(0, 1, -1)).toBe(0);
    expect(smoothStep(0, 1, 0)).toBe(0);
    expect(smoothStep(0, 1, 0.5)).toBeCloseTo(0.5, 12);
    expect(smoothStep(0, 1, 1)).toBe(1);
    expect(smoothStep(0, 1, 2)).toBe(1);
  });
});
