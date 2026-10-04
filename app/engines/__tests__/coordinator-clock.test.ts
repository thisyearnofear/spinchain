import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RideCoordinator } from "../coordinator";
import { useRideStore } from "@/app/stores/ride-store";
import { PRACTICE_WALL_DURATION_SEC } from "@/app/lib/practice-demo";
import { calculateEffortScore } from "@/app/lib/rewards/calculator";
import type { RideStartConfig } from "../types";

/**
 * The coordinator's 1Hz sample timer is the only writer of elapsedTime and
 * rideProgress. These tests lock that clock: class time always advances,
 * route progress follows effort on every ride. No scene, no frame loop.
 */

function browserStubs() {
  const storage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", {
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: storage,
    devicePixelRatio: 1,
  });
  vi.stubGlobal("document", {
    body: { classList: { add() {}, remove() {} } },
    createElement: () => ({ getContext: () => null }),
  });
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
}

function rideConfig(overrides: Partial<RideStartConfig> = {}): RideStartConfig {
  return {
    classId: "clock-test",
    classData: { metadata: { duration: 1, name: "Clock" } },
    deviceType: "desktop",
    performanceTier: "high",
    isPracticeMode: false,
    walletConnected: false,
    rewardMode: "zk-batch",
    coachingConfig: {
      agentName: "Atlas",
      personality: "zen",
      workoutPlan: {
        id: "clock-plan",
        name: "Clock",
        intervals: [
          { phase: "warmup", durationSeconds: 2, coachCue: "Roll" },
          { phase: "sprint", durationSeconds: 60, coachCue: "Go" },
        ],
        totalDuration: 62,
        difficulty: "moderate",
        tags: [],
      },
      instructorProfile: null,
      marketStats: { ticketsSold: 0, revenue: 0, capacity: 0 },
      aiActive: false,
    },
    ...overrides,
  };
}

describe("RideCoordinator ride clock", () => {
  let coordinator: RideCoordinator | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    browserStubs();
    useRideStore.setState({
      session: null,
      isActive: false,
      isPaused: false,
      elapsedTime: 0,
      rideProgress: 0,
      isStarting: false,
      isExiting: false,
      multiGhostState: [],
    });
  });

  afterEach(() => {
    coordinator?.dispose();
    coordinator = null;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function startRide(overrides?: Partial<RideStartConfig>) {
    coordinator = new RideCoordinator();
    await coordinator.start(rideConfig(overrides));
    return coordinator;
  }

  async function tick(seconds = 1) {
    await vi.advanceTimersByTimeAsync(seconds * 1000);
  }

  it("scales route progress by effort on a class ride while the class clock and intervals keep time", async () => {
    const ride = await startRide();
    const durationSeconds = 60;
    const intervals: string[] = [];
    ride.bus.on("interval:changed", ({ phase }) => {
      intervals.push(phase);
    });

    // Under ~150 effort the world holds. The class clock still ticks, and
    // the interval clock follows elapsed time rather than route progress.
    ride.telemetry.rawSnapshot.effort = 0;
    await tick();
    expect(useRideStore.getState().elapsedTime).toBe(1);
    expect(useRideStore.getState().rideProgress).toBe(0);
    expect(intervals).toEqual(["warmup"]);

    ride.telemetry.rawSnapshot.effort = 120;
    await tick();
    expect(useRideStore.getState().elapsedTime).toBe(2);
    expect(useRideStore.getState().rideProgress).toBe(0);
    expect(intervals).toEqual(["warmup", "sprint"]);

    // ~350 effort is 1x class pace: one class-second of route per tick.
    ride.telemetry.rawSnapshot.effort = 350;
    await tick();
    expect(useRideStore.getState().elapsedTime).toBe(3);
    expect(useRideStore.getState().rideProgress).toBeCloseTo((1 / durationSeconds) * 100);

    // Hard pedaling caps at 1.6x. Anything above the cap does not go faster.
    ride.telemetry.rawSnapshot.effort = 470;
    await tick();
    expect(useRideStore.getState().elapsedTime).toBe(4);
    expect(useRideStore.getState().rideProgress).toBeCloseTo((2.6 / durationSeconds) * 100);

    ride.telemetry.rawSnapshot.effort = 1000;
    await tick();
    expect(useRideStore.getState().elapsedTime).toBe(5);
    expect(useRideStore.getState().rideProgress).toBeCloseTo((4.2 / durationSeconds) * 100);

    // Easing off slows, then stops, the rider. The clock keeps ticking.
    const held = useRideStore.getState().rideProgress;
    ride.telemetry.rawSnapshot.effort = 100;
    await tick();
    expect(useRideStore.getState().elapsedTime).toBe(6);
    expect(useRideStore.getState().rideProgress).toBe(held);

    ride.telemetry.rawSnapshot.effort = 151;
    await tick();
    expect(useRideStore.getState().elapsedTime).toBe(7);
    expect(useRideStore.getState().rideProgress).toBeCloseTo(
      ((4.2 + 0.005) / durationSeconds) * 100,
    );
    expect(intervals).toEqual(["warmup", "sprint"]);
  });

  it("keeps practice rides on the compressed class clock and the same effort factor", async () => {
    const classMinutes = 30;
    const durationSeconds = classMinutes * 60;
    const scale = Math.max(1, durationSeconds / PRACTICE_WALL_DURATION_SEC);
    await startRide({
      isPracticeMode: true,
      classData: { metadata: { duration: classMinutes, name: "Demo" } },
    });

    coordinator!.telemetry.rawSnapshot.effort = 0;
    await tick();
    expect(useRideStore.getState().elapsedTime).toBe(scale);
    expect(useRideStore.getState().rideProgress).toBe(0);

    coordinator!.telemetry.rawSnapshot.effort = 350;
    await tick();
    expect(useRideStore.getState().elapsedTime).toBe(scale * 2);
    expect(useRideStore.getState().rideProgress).toBeCloseTo((scale / durationSeconds) * 100);

    coordinator!.telemetry.rawSnapshot.effort = 1000;
    await tick();
    expect(useRideStore.getState().elapsedTime).toBe(scale * 3);
    expect(useRideStore.getState().rideProgress).toBeCloseTo(
      ((scale + scale * 1.6) / durationSeconds) * 100,
    );
  });

  it("derives BLE effort from power and heart rate so a bike moves the world", async () => {
    const ride = await startRide();
    const durationSeconds = 60;

    // Coasting: no power holds the rider, even with heart rate and cadence.
    ride.ingestBleMetrics({ power: 0, heartRate: 160, cadence: 90 });
    expect(ride.telemetry.rawSnapshot.effort).toBe(0);
    await tick();
    expect(useRideStore.getState().elapsedTime).toBe(1);
    expect(useRideStore.getState().rideProgress).toBe(0);

    // Steady pedal on the existing 0–1000 score: 200W and 100bpm is exactly
    // 350, which is 1x class pace. Cadence is not part of that score.
    const steadyEffort = calculateEffortScore({
      heartRate: 100,
      power: 200,
      durationSeconds: 0,
    });
    expect(steadyEffort).toBe(350);
    ride.ingestBleMetrics({ power: 200, heartRate: 100, cadence: 85 });
    expect(ride.telemetry.rawSnapshot.effort).toBe(steadyEffort);
    ride.ingestBleMetrics({ power: 200, heartRate: 100, cadence: 40 });
    expect(ride.telemetry.rawSnapshot.effort).toBe(steadyEffort);
    await tick();
    expect(useRideStore.getState().elapsedTime).toBe(2);
    expect(useRideStore.getState().rideProgress).toBeCloseTo((1 / durationSeconds) * 100);

    // Hard power and heart rate reach the 1.6x cap.
    const hardEffort = calculateEffortScore({
      heartRate: 180,
      power: 320,
      durationSeconds: 0,
    });
    expect(hardEffort).toBeGreaterThanOrEqual(470);
    ride.ingestBleMetrics({ power: 320, heartRate: 180, cadence: 110 });
    expect(ride.telemetry.rawSnapshot.effort).toBe(hardEffort);
    await tick();
    expect(useRideStore.getState().elapsedTime).toBe(3);
    expect(useRideStore.getState().rideProgress).toBeCloseTo(((1 + 1.6) / durationSeconds) * 100);

    const held = useRideStore.getState().rideProgress;
    ride.ingestBleMetrics({ power: 0, heartRate: 155, cadence: 0 });
    await tick();
    expect(useRideStore.getState().elapsedTime).toBe(4);
    expect(useRideStore.getState().rideProgress).toBe(held);
  });

  it("leaves keyboard and simulator effort untouched", async () => {
    const ride = await startRide();
    ride.ingestSimulatorMetrics({
      heartRate: 150,
      power: 300,
      cadence: 90,
      speed: 28,
      effort: 120,
    });
    expect(ride.telemetry.rawSnapshot.effort).toBe(120);
    await tick();
    expect(useRideStore.getState().elapsedTime).toBe(1);
    expect(useRideStore.getState().rideProgress).toBe(0);

    ride.ingestSimulatorMetrics({
      heartRate: 160,
      power: 280,
      cadence: 95,
      speed: 30,
      effort: 350,
    });
    expect(ride.telemetry.rawSnapshot.effort).toBe(350);
    await tick();
    expect(useRideStore.getState().elapsedTime).toBe(2);
    expect(useRideStore.getState().rideProgress).toBeCloseTo((1 / 60) * 100);
  });
});
