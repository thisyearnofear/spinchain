import { describe, expect, it } from "vitest";
import { computeReactiveParams } from "../world-reactivity";
import { RIDE_EFFORT } from "@/app/lib/ride-effort";

const stats = (intensity: number) => ({ power: 0, hr: 0, cadence: 0, intensity });

describe("chromatic aberration", () => {
  it("stays off from rest through a hard interval push", () => {
    for (const intensity of [0, 0.3, 0.6, 0.9]) {
      expect(computeReactiveParams("neon", stats(intensity), "interval", 50).chromaticOffset).toBe(0);
    }
  });

  it("ramps in only at the top of the effort range, strongest in a sprint", () => {
    const max = RIDE_EFFORT.INTENSITY_MAX;
    const endurance = computeReactiveParams("neon", stats(max), "interval", 50).chromaticOffset;
    const sprint = computeReactiveParams("neon", stats(max), "sprint", 50).chromaticOffset;
    expect(endurance).toBeGreaterThan(0);
    expect(sprint).toBeGreaterThan(endurance);
    expect(sprint).toBeLessThanOrEqual(0.0035);
  });
});
