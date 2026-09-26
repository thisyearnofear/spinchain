import { describe, expect, it } from "vitest";
import { ProgressInterpolator, dampFactor } from "@/app/lib/progress-interpolator";

describe("ProgressInterpolator", () => {
  it("moves at constant speed between steady 1Hz ticks", () => {
    const p = new ProgressInterpolator(0, 0);
    p.push(0.01, 1000);
    p.push(0.02, 2000);
    // Halfway through the second segment: halfway from 0.01 to 0.02.
    expect(p.sample(2500)).toBeCloseTo(0.015, 5);
    // Evenly spaced samples produce evenly spaced values (no surge/coast).
    const a = p.sample(2250) - p.sample(2000);
    const b = p.sample(2750) - p.sample(2500);
    expect(a).toBeCloseTo(b, 6);
  });

  it("never overshoots the latest target", () => {
    const p = new ProgressInterpolator(0, 0);
    p.push(0.05, 1000);
    expect(p.sample(10_000)).toBe(0.05);
  });

  it("starts the next segment from the current display value (continuous)", () => {
    const p = new ProgressInterpolator(0, 0);
    p.push(0.01, 1000);
    const before = p.sample(1400);
    p.push(0.02, 1400); // early tick
    expect(p.sample(1400)).toBeCloseTo(before, 6);
  });

  it("snaps on backwards moves (restart)", () => {
    const p = new ProgressInterpolator(0.5, 0);
    p.push(0, 1000);
    expect(p.sample(1000)).toBe(0);
  });

  it("ignores non-finite targets", () => {
    const p = new ProgressInterpolator(0.1, 0);
    p.push(Number.NaN, 1000);
    expect(p.sample(2000)).toBe(0.1);
  });
});

describe("dampFactor", () => {
  it("is frame-rate independent", () => {
    // Two 30fps steps == four 60fps steps (within float error).
    const k30 = dampFactor(5, 1 / 30);
    const k60 = dampFactor(5, 1 / 60);
    const after30 = 1 - (1 - k30) ** 2;
    const after60 = 1 - (1 - k60) ** 4;
    expect(after30).toBeCloseTo(after60, 10);
  });
});
