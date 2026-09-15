import { describe, expect, it } from "vitest";
import {
  getWeeklyLoad,
  HARD_EFFORT_THRESHOLD,
} from "@/app/lib/analytics/training-load";
import type { RideSummary } from "@/app/lib/analytics/ride-history";

const NOW = 1_800_000_000_000; // fixed reference instant
const DAY = 24 * 60 * 60 * 1000;

function ride(daysAgo: number, avgEffort: number): RideSummary {
  return {
    schemaVersion: "1.0",
    id: `ride-${daysAgo}-${avgEffort}`,
    idempotencyKey: `key-${daysAgo}-${avgEffort}`,
    riderId: "rider",
    classId: "class",
    className: "Test Ride",
    instructor: "coach",
    completedAt: NOW - daysAgo * DAY,
    durationSec: 1800,
    avgHeartRate: 140,
    avgPower: 200,
    avgEffort,
    spinEarned: 10,
    telemetrySource: "simulator",
    effortTier: "gold",
    zones: { recovery: 0, endurance: 50, threshold: 40, sprint: 10 },
    proof: {},
    sync: { status: "local_only", retryCount: 0 },
  } as RideSummary;
}

describe("getWeeklyLoad", () => {
  it("returns zero load for no rides", () => {
    const load = getWeeklyLoad([], NOW);
    expect(load).toEqual({
      ridesLast7d: 0,
      hardRidesLast7d: 0,
      minutesLast7d: 0,
      fatigued: false,
    });
  });

  it("counts only rides inside the trailing 7-day window", () => {
    const load = getWeeklyLoad([ride(8, 900), ride(2, 900)], NOW);
    expect(load.ridesLast7d).toBe(1);
    expect(load.hardRidesLast7d).toBe(1);
    expect(load.fatigued).toBe(false);
  });

  it("flags fatigue at 3 hard rides in the window", () => {
    const rides = [
      ride(1, HARD_EFFORT_THRESHOLD),
      ride(3, 800),
      ride(5, 700),
      ride(6, 200), // easy ride doesn't count toward fatigue
    ];
    const load = getWeeklyLoad(rides, NOW);
    expect(load.ridesLast7d).toBe(4);
    expect(load.hardRidesLast7d).toBe(3);
    expect(load.fatigued).toBe(true);
  });

  it("does not flag fatigue for easy-volume weeks", () => {
    const rides = [ride(1, 300), ride(2, 400), ride(3, 350), ride(4, 500)];
    const load = getWeeklyLoad(rides, NOW);
    expect(load.hardRidesLast7d).toBe(0);
    expect(load.fatigued).toBe(false);
  });

  it("sums minutes across the window", () => {
    const load = getWeeklyLoad([ride(1, 500), ride(2, 500)], NOW);
    expect(load.minutesLast7d).toBe(60); // 2 × 1800s
  });

  it("ignores future-dated rides", () => {
    const load = getWeeklyLoad([ride(-1, 900), ride(-2, 900), ride(-3, 900)], NOW);
    expect(load.hardRidesLast7d).toBe(0);
    expect(load.fatigued).toBe(false);
  });
});
