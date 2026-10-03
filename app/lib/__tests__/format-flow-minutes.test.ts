import { describe, it, expect } from "vitest";
import { formatFlowMinutes } from "@/app/components/features/common/gamification-bar";

describe("formatFlowMinutes", () => {
  it("rounds fractional minutes for riders", () => {
    expect(formatFlowMinutes(9.191964555555158)).toBe("9.2");
    expect(formatFlowMinutes(0.4)).toBe("0.4");
  });

  it("uses whole minutes at 10+", () => {
    expect(formatFlowMinutes(19)).toBe("19");
    expect(formatFlowMinutes(19.6)).toBe("20");
  });

  it("handles zero and garbage", () => {
    expect(formatFlowMinutes(0)).toBe("0");
    expect(formatFlowMinutes(NaN)).toBe("0");
  });
});
