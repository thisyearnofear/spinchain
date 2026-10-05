import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RideCoordinator } from "../coordinator";
import { useRideStore } from "@/app/stores/ride-store";
import { PRACTICE_WALL_DURATION_SEC } from "@/app/lib/practice-demo";
import type { RideStartConfig } from "../types";

/**
 * The coordinator's 1Hz sample timer is the only writer of elapsedTime and
 * rideProgress. These tests lock that clock: the class clock always advances,
 * the route position a class ride reports follows that clock, coaching gets
 * the route fraction, and no ingest path — however fast — moves the clock.
 * No scene, no frame loop.
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

  it("advances a class ride on the class clock, whatever the effort", async () => {
    const ride = await startRide();
    const durationSeconds = 60;
    const intervals: string[] = [];
    ride.bus.on("interval:changed", ({ phase }) => {
      intervals.push(phase);
    });

    // Baseline for the clock/route split: a class ride advances on time, so
    // effort has no say in where the rider is on the route — including
    // effort 0, which is what every real bike reports today.
    for (const [index, effort] of [0, 120, 350, 1000].entries()) {
      ride.telemetry.rawSnapshot.effort = effort;
      await tick();
      const { elapsedTime, rideProgress } = useRideStore.getState();
      expect(elapsedTime).toBe(index + 1);
      expect(rideProgress).toBeCloseTo(((index + 1) / durationSeconds) * 100);
    }

    // Intervals follow the elapsed clock, not the rider's route position.
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

  it("is the only writer of the ride clock, whatever ingest rate follows", async () => {
    const ride = await startRide();
    await tick();
    const { elapsedTime, rideProgress } = useRideStore.getState();
    expect(elapsedTime).toBe(1);

    // Telemetry arrives at up to 10 Hz from the commit loop and on every BLE
    // notification. None of it may step the clock — a second writer would
    // make route position depend on notification rate and frame timing.
    for (let i = 0; i < 30; i++) {
      ride.ingestBleMetrics({ power: 250, heartRate: 165, cadence: 95 });
      ride.ingestSimulatorMetrics({
        power: 250,
        heartRate: 165,
        cadence: 95,
        speed: 30,
        effort: 900,
      });
    }
    const held = useRideStore.getState();
    expect(held.elapsedTime).toBe(elapsedTime);
    expect(held.rideProgress).toBe(rideProgress);

    await tick();
    expect(useRideStore.getState().elapsedTime).toBe(elapsedTime + 1);
  });

  it("hands coaching the route fraction, not a percent", async () => {
    const ride = await startRide();
    const ticks: number[] = [];
    ride.bus.on("lifecycle:tick", ({ progress }) => {
      ticks.push(progress);
    });

    await tick(2);

    // StoryBeat.progress is a 0–1 fraction; the store keeps a percent for
    // display. Feeding one to the other put every beat in the opening seconds.
    expect(ticks).toHaveLength(2);
    expect(ticks[0]).toBeCloseTo(1 / 60);
    expect(ticks[1]).toBeCloseTo(2 / 60);
    expect(useRideStore.getState().rideProgress).toBeCloseTo((2 / 60) * 100);
  });

  it("keeps BLE metrics out of the effort ledger", async () => {
    const ride = await startRide();
    ride.ingestBleMetrics({ power: 220, heartRate: 158, cadence: 92 });

    const snapshot = ride.telemetry.rawSnapshot;
    expect(snapshot.power).toBe(220);
    expect(snapshot.heartRate).toBe(158);
    // `effort` is the 0–1000 reward/progression scale, not a device field.
    // Deriving it inside the ride loop would rewrite persisted progression
    // (avg_effort, journey tiers, coach memory) from a visual change. A
    // bike-driven effort score is separate work on the rewards side.
    expect(snapshot.effort).toBe(0);
  });

  it("passes simulator and keyboard effort through unchanged", async () => {
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
  });
});
