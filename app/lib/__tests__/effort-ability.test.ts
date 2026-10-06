import { describe, it, expect } from "vitest";
import {
  getSprintBeamState,
  shouldShowFlowUnlock,
  getFlowUnlockParams,
} from "@/app/lib/effort-ability";
import { RIDE_EFFORT, resolveAnchors, ridingIntensity } from "@/app/lib/ride-effort";

describe("effort-ability (wedge delight gates)", () => {
  it("beam only arms on sprint/interval above the rider's threshold", () => {
    expect(getSprintBeamState("recovery", 1.6).active).toBe(false);
    expect(getSprintBeamState(null, 1.6).active).toBe(false);
    expect(getSprintBeamState("sprint", 0.9).active).toBe(false);
    expect(getSprintBeamState("sprint", Number.NaN).active).toBe(false);
    expect(getSprintBeamState("interval", 1.3).active).toBe(true);
  });

  it("beam intensity ramps from threshold to the cap, not a switch", () => {
    const low = getSprintBeamState("sprint", 1.1);
    const high = getSprintBeamState("sprint", 1.8);
    expect(low.active).toBe(true);
    expect(high.intensity).toBeGreaterThan(low.intensity);
    expect(getSprintBeamState("sprint", RIDE_EFFORT.INTENSITY_MAX).intensity).toBe(1);
    expect(getSprintBeamState("sprint", 5).intensity).toBe(1);
  });

  it("the same watts arm one rider's beam and not another's", () => {
    // 220 W is a sprint for a 150 W-FTP rider and a recovery spin for 300 W.
    const watts = 220;
    const capability = { power: true, heartRate: false, cadence: false };
    const beginner = resolveAnchors({ profile: { ftp: 150 } });
    const racer = resolveAnchors({ profile: { ftp: 300 } });
    const beginnerIntensity = ridingIntensity(watts, 0, 90, beginner, capability);
    const racerIntensity = ridingIntensity(watts, 0, 90, racer, capability);
    expect(getSprintBeamState("sprint", beginnerIntensity).active).toBe(true);
    expect(getSprintBeamState("sprint", racerIntensity).active).toBe(false);
  });

  it("matches the old 180 W floor for an anonymous rider", () => {
    const anon = resolveAnchors();
    const capability = { power: true, heartRate: false, cadence: false };
    expect(getSprintBeamState("sprint", ridingIntensity(175, 0, 90, anon, capability)).active).toBe(false);
    expect(getSprintBeamState("sprint", ridingIntensity(200, 0, 90, anon, capability)).active).toBe(true);
  });

  it("a cadence-only bike can never hold the beam", () => {
    const capability = { power: false, heartRate: false, cadence: true };
    const intensity = ridingIntensity(0, 0, 140, resolveAnchors(), capability);
    expect(getSprintBeamState("sprint", intensity).active).toBe(false);
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
