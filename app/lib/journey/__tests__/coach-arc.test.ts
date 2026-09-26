import { describe, expect, it } from "vitest";
import { resolveBetweenRideState, BETWEEN_RIDE_LABELS } from "@/app/lib/character-state";
import { composeCoachArc } from "@/app/lib/journey/coach-arc";
import { createInitialMemory } from "@/app/lib/walrus/coach-memory";
import type { RideSummary } from "@/app/lib/analytics/ride-history";

const NOW = new Date("2026-03-21T12:00:00Z").getTime();
const DAY = 86_400_000;

function ride(daysAgo: number, avgEffort = 400, avgPower = 120): RideSummary {
  return {
    id: `ride-${daysAgo}-${avgEffort}-${avgPower}`,
    riderId: "guest",
    classId: "c1",
    className: "Class",
    instructor: "Coach Demo",
    completedAt: NOW - daysAgo * DAY,
    durationSec: 1800,
    avgEffort,
    avgPower,
  } as RideSummary;
}

describe("resolveBetweenRideState", () => {
  it("is idle with no rides", () => {
    expect(
      resolveBetweenRideState({ rideCount: 0, lastRideAt: null, fatigued: false, lastRideWasPR: false, now: NOW }),
    ).toBe("idle");
  });

  it("celebrates a fresh PR (within a day)", () => {
    expect(
      resolveBetweenRideState({ rideCount: 3, lastRideAt: NOW - DAY * 0.5, fatigued: false, lastRideWasPR: true, now: NOW }),
    ).toBe("celebrate");
  });

  it("does not celebrate a stale PR", () => {
    expect(
      resolveBetweenRideState({ rideCount: 3, lastRideAt: NOW - DAY * 3, fatigued: false, lastRideWasPR: true, now: NOW }),
    ).toBe("ready");
  });

  it("is fatigued when the training-load model flags it (beats recovery)", () => {
    expect(
      resolveBetweenRideState({ rideCount: 5, lastRideAt: NOW - DAY, fatigued: true, lastRideWasPR: false, now: NOW }),
    ).toBe("fatigued");
  });

  it("is recovering within ~1.5 days of a ride", () => {
    expect(
      resolveBetweenRideState({ rideCount: 2, lastRideAt: NOW - DAY, fatigued: false, lastRideWasPR: false, now: NOW }),
    ).toBe("recovery");
  });

  it("is ready after 2+ rested days", () => {
    expect(
      resolveBetweenRideState({ rideCount: 2, lastRideAt: NOW - DAY * 3, fatigued: false, lastRideWasPR: false, now: NOW }),
    ).toBe("ready");
  });

  it("has a rider-facing label for every state", () => {
    for (const state of ["idle", "ready", "riding", "flow", "recovery", "celebrate", "fatigued"] as const) {
      expect(BETWEEN_RIDE_LABELS[state].length).toBeGreaterThan(0);
    }
  });
});

describe("composeCoachArc", () => {
  it("welcomes a brand-new rider (no fake history)", () => {
    const arc = composeCoachArc({ rides: [], memory: null, personality: "zen", coachName: "Coach Demo", now: NOW });
    expect(arc.state).toBe("idle");
    expect(arc.headline).toContain("first ride");
    expect(arc.streakLine).toBeNull();
  });

  it("celebrates a PR in the coach's voice, with watts from memory", () => {
    const memory = {
      ...createInitialMemory("guest", "Coach Demo:drill-sergeant"),
      rides: 3,
      lastRideAt: NOW - DAY * 0.5,
      lastRide: { avgPower: 212, durationSec: 1800, completed: true },
      bestAvgPower: 212,
    };
    const arc = composeCoachArc({
      rides: [ride(0.5, 700, 212), ride(2), ride(4)],
      memory,
      personality: "drill-sergeant",
      coachName: "Coach Demo",
      now: NOW,
    });
    expect(arc.state).toBe("celebrate");
    expect(arc.message).toContain("212 watts");
  });

  it("does not claim a PR when the last ride did not beat bestAvgPower", () => {
    const memory = {
      ...createInitialMemory("guest", "Coach Demo:zen"),
      rides: 2,
      lastRideAt: NOW - DAY * 0.5,
      lastRide: { avgPower: 150, durationSec: 1800, completed: true },
      bestAvgPower: 212,
    };
    const arc = composeCoachArc({
      rides: [ride(0.5, 400, 150), ride(2)],
      memory,
      personality: "zen",
      coachName: "Coach Demo",
      now: NOW,
    });
    expect(arc.state).toBe("recovery");
    expect(arc.message).not.toContain("best");
  });

  it("does not celebrate when history's last ride is not the memory PR ride", () => {
    // Zero-effort aborts land in history but not in coach memory
    // (persistCoachMemory skips them), so the two sources can point at
    // different "last rides" — the PR copy must not describe the abort.
    const memory = {
      ...createInitialMemory("guest", "Coach Demo:zen"),
      rides: 3,
      lastRideAt: NOW - DAY * 0.5,
      lastRide: { avgPower: 212, durationSec: 1800, completed: true },
      bestAvgPower: 212,
    };
    const arc = composeCoachArc({
      rides: [ride(0.1, 0, 0), ride(0.5, 700, 212), ride(2)],
      memory,
      personality: "zen",
      coachName: "Coach Demo",
      now: NOW,
    });
    expect(arc.state).not.toBe("celebrate");
    expect(arc.message).not.toContain("new best");
  });

  it("pluralizes singular hours and days in the data voice", () => {
    const recent = composeCoachArc({ rides: [ride(1 / 24)], memory: null, personality: "data", coachName: "Coach Demo", now: NOW });
    expect(recent.message).toContain("about 1 hour ago");
    const rested = composeCoachArc({ rides: [ride(1.6)], memory: null, personality: "data", coachName: "Coach Demo", now: NOW });
    expect(rested.message).toContain("It's been 1 day since");
  });

  it("celebrates recovery as training when the load model flags fatigue", () => {
    const rides = [ride(0.4, 700), ride(1.5, 800), ride(3, 750)];
    const arc = composeCoachArc({ rides, memory: null, personality: "data", coachName: "Coach Demo", now: NOW });
    expect(arc.state).toBe("fatigued");
    expect(arc.stateLabel).toBe("Ease-up day");
    expect(arc.message).toContain("3 hard");
  });

  it("frames the day after a ride as recovery, not guilt", () => {
    const arc = composeCoachArc({ rides: [ride(1)], memory: null, personality: "zen", coachName: "Coach Demo", now: NOW });
    expect(arc.state).toBe("recovery");
    expect(arc.stateLabel).toBe("Recovering");
  });

  it("welcomes back a rider after a long gap without guilt", () => {
    const arc = composeCoachArc({ rides: [ride(10)], memory: null, personality: "drill-sergeant", coachName: "Coach Demo", now: NOW });
    expect(arc.state).toBe("ready");
    expect(arc.message.toLowerCase()).not.toContain("streak lost");
  });

  it("acknowledges a real streak", () => {
    // getStreakStats anchors on the real clock, so these fixtures are
    // relative to actual now (same wall time each day → calendar-safe).
    const realNow = Date.now();
    const streakRide = (daysAgo: number) => ({
      ...ride(daysAgo),
      completedAt: realNow - daysAgo * DAY,
    });
    const arc = composeCoachArc({
      rides: [streakRide(0), streakRide(1), streakRide(2)],
      memory: null,
      personality: "zen",
      coachName: "Coach Demo",
      now: realNow,
    });
    expect(arc.streakLine).toBe("3 days in a row");
  });

  it("uses the coach's real name and reports total ride count", () => {
    const arc = composeCoachArc({
      rides: [ride(3), ride(6)],
      memory: null,
      personality: "data",
      coachName: "Coach Nova",
      now: NOW,
    });
    expect(arc.coachName).toBe("Coach Nova");
    expect(arc.headline).toBe("2 rides on the books");
  });
});
