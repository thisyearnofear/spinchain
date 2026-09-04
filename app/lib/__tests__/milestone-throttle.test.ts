import { describe, expect, it } from "vitest";
import { shouldShowMinuteMilestone } from "@/app/lib/milestone-throttle";

describe("shouldShowMinuteMilestone", () => {
  it("allows the first overlay when nothing has shown yet", () => {
    expect(
      shouldShowMinuteMilestone({
        lastOverlayAt: 0,
        now: 1_000,
      }),
    ).toBe(true);
  });

  it("blocks minute spam within the cooldown (compressed practice ~1.5s)", () => {
    expect(
      shouldShowMinuteMilestone({
        lastOverlayAt: 5_000,
        now: 6_500,
        cooldownMs: 10_000,
      }),
    ).toBe(false);
  });

  it("allows another milestone after the cooldown", () => {
    expect(
      shouldShowMinuteMilestone({
        lastOverlayAt: 5_000,
        now: 16_000,
        cooldownMs: 10_000,
      }),
    ).toBe(true);
  });
});
