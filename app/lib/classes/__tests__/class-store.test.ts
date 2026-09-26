import { describe, it, expect } from "vitest";
import { parseWorkoutPlan } from "../class-store";
import { composeClass } from "@/app/lib/agent/class-composer";

describe("parseWorkoutPlan", () => {
  it("accepts a composed plan", () => {
    const { plan } = composeClass({ goal: "endurance", durationMinutes: 30, personality: "zen" });
    expect(parseWorkoutPlan(plan)).toEqual(plan);
  });

  it("rejects non-objects and missing pieces", () => {
    expect(parseWorkoutPlan(null)).toBeNull();
    expect(parseWorkoutPlan("nope")).toBeNull();
    expect(parseWorkoutPlan({})).toBeNull();
    expect(parseWorkoutPlan({ id: "x" })).toBeNull();
    expect(parseWorkoutPlan({ id: "x", intervals: [] })).toBeNull();
  });

  it("rejects malformed intervals", () => {
    expect(
      parseWorkoutPlan({ id: "x", intervals: [{ phase: "warmup", durationSeconds: 0 }] }),
    ).toBeNull();
    expect(
      parseWorkoutPlan({ id: "x", intervals: [{ phase: "warmup" }] }),
    ).toBeNull();
    expect(
      parseWorkoutPlan({ id: "x", intervals: [{ durationSeconds: 60 }] }),
    ).toBeNull();
  });
});
