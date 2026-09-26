import { describe, it, expect } from "vitest";
import {
  CLASS_GOALS,
  COACH_PERSONALITIES,
  composeClass,
  validateComposedClass,
  type ClassGoal,
} from "../class-composer";

const ALL_DURATIONS = [20, 30, 45, 60];

describe("composeClass", () => {
  it("composes a valid, rideable class for every goal and duration", () => {
    for (const goal of CLASS_GOALS) {
      for (const durationMinutes of ALL_DURATIONS) {
        const composed = composeClass({ goal, durationMinutes, personality: "data" });
        expect(validateComposedClass(composed)).toEqual([]);
      }
    }
  });

  it("plan totals match the class duration exactly", () => {
    for (const goal of CLASS_GOALS) {
      for (const durationMinutes of ALL_DURATIONS) {
        const composed = composeClass({ goal, durationMinutes, personality: "zen" });
        expect(composed.plan.totalDuration).toBe(durationMinutes * 60);
      }
    }
  });

  it("every interval carries a power band and a coach cue", () => {
    const composed = composeClass({ goal: "hiit", durationMinutes: 45, personality: "zen" });
    for (const interval of composed.plan.intervals) {
      expect(interval.targetPower?.[0]).toBeGreaterThan(0);
      expect(interval.targetPower?.[1]).toBeGreaterThan(interval.targetPower?.[0] ?? 0);
      expect(interval.coachCue?.trim().length).toBeGreaterThan(0);
    }
  });

  it("starts with a warmup and ends with a cooldown", () => {
    const composed = composeClass({ goal: "climb", durationMinutes: 45, personality: "data" });
    expect(composed.plan.intervals[0].phase).toBe("warmup");
    expect(composed.plan.intervals[composed.plan.intervals.length - 1].phase).toBe("cooldown");
  });

  it("voices cues in the coach's personality", () => {
    const zen = composeClass({ goal: "hiit", durationMinutes: 30, personality: "zen" });
    const drill = composeClass({ goal: "hiit", durationMinutes: 30, personality: "drill-sergeant" });
    const zenSprint = zen.plan.intervals.find((i) => i.phase === "sprint");
    const drillSprint = drill.plan.intervals.find((i) => i.phase === "sprint");
    expect(zenSprint?.coachCue).not.toBe(drillSprint?.coachCue);
  });

  it("varies repeated cues within a class", () => {
    const composed = composeClass({ goal: "hiit", durationMinutes: 45, personality: "data" });
    const sprintCues = composed.plan.intervals
      .filter((i) => i.phase === "sprint")
      .map((i) => i.coachCue);
    expect(new Set(sprintCues).size).toBeGreaterThan(1);
  });

  it("defaults the environment per goal and respects an override", () => {
    const climb = composeClass({ goal: "climb", durationMinutes: 30, personality: "zen" });
    expect(climb.themeName).toBe("alpine");
    const themed = composeClass({
      goal: "climb",
      durationMinutes: 30,
      personality: "zen",
      themeName: "mars",
    });
    expect(themed.themeName).toBe("mars");
  });

  it("is deterministic: same intent, same class", () => {
    const intent = { goal: "endurance" as ClassGoal, durationMinutes: 45, personality: "zen" as const };
    expect(composeClass(intent)).toEqual(composeClass(intent));
  });

  it("rejects out-of-range durations and unknown intents", () => {
    expect(() => composeClass({ goal: "hiit", durationMinutes: 5, personality: "zen" })).toThrow();
    expect(() => composeClass({ goal: "hiit", durationMinutes: 120, personality: "zen" })).toThrow();
    expect(() =>
      composeClass({ goal: "yolo" as ClassGoal, durationMinutes: 30, personality: "zen" }),
    ).toThrow();
  });

  it("uses a personality-appropriate default coach name", () => {
    for (const personality of COACH_PERSONALITIES) {
      const composed = composeClass({ goal: "endurance", durationMinutes: 30, personality });
      expect(composed.coachName.length).toBeGreaterThan(0);
    }
    const custom = composeClass({
      goal: "endurance",
      durationMinutes: 30,
      personality: "zen",
      coachName: "Coach Rivera",
    });
    expect(custom.coachName).toBe("Coach Rivera");
  });
});
