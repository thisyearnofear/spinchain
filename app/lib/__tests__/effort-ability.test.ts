import { describe, it, expect } from "vitest";
import {
  getSprintBeamState,
  shouldShowFlowUnlock,
  getFlowUnlockParams,
} from "@/app/lib/effort-ability";

describe("effort-ability (wedge delight gates)", () => {
  it("beam only arms on sprint/interval with real watts", () => {
    expect(getSprintBeamState("recovery", 400, 900).active).toBe(false);
    expect(getSprintBeamState("sprint", 100, 900).active).toBe(false);
    expect(getSprintBeamState("sprint", 400, 100).active).toBe(false);
    expect(getSprintBeamState(null, 400, 900).active).toBe(false);
  });

  it("beam intensity ramps with power, not a switch", () => {
    const low = getSprintBeamState("sprint", 200, 500);
    const high = getSprintBeamState("sprint", 360, 900);
    expect(low.active).toBe(true);
    expect(high.active).toBe(true);
    expect(high.intensity).toBeGreaterThan(low.intensity);
    expect(high.intensity).toBeLessThanOrEqual(1);
  });

  it("flow unlock opens at tier 3+", () => {
    expect(shouldShowFlowUnlock(0)).toBe(false);
    expect(shouldShowFlowUnlock(2)).toBe(false);
    expect(shouldShowFlowUnlock(3)).toBe(true);
    expect(shouldShowFlowUnlock(4)).toBe(true);
    expect(getFlowUnlockParams(2).active).toBe(false);
    expect(getFlowUnlockParams(4).glowOpacity).toBeGreaterThan(
      getFlowUnlockParams(3).glowOpacity,
    );
  });
});
