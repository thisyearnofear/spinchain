import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RideCoordinator } from "../coordinator";
import { useRideStore } from "@/app/stores/ride-store";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
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
  // The commit loop is driven by requestAnimationFrame in production. Stubbing
  // it to a no-op meant the telemetry store never received a committed snapshot,
  // which is fine while nothing reads it — but route pacing now reads the same
  // committed intensity the world is drawn from, so the loop has to run. Scheduling
  // it as a timer keeps it on fake time: no runaway recursion, and TelemetryEngine's
  // own throttle decides how many of those frames actually commit.
  vi.stubGlobal("requestAnimationFrame", (callback: (time: number) => void) =>
    setTimeout(() => callback(Date.now()), 16),
  );
  vi.stubGlobal("cancelAnimationFrame", (handle: number) => clearTimeout(handle));
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

  it("records which channels a bike actually reports", async () => {
    const ride = await startRide();
    // Nothing has arrived yet, so nothing is known: with no evidence either way
    // no channel can be assumed to exist.
    expect(ride.telemetry.capability).toEqual({ power: false, heartRate: false, cadence: false });

    // An FTMS bike with no strap: watts notifications only.
    ride.ingestBleMetrics({ power: 210, channels: { power: true, heartRate: false, cadence: true, speed: true } });
    expect(ride.telemetry.capability).toEqual({ power: true, heartRate: false, cadence: true });

    // Channels accumulate — heart rate arrives on its own characteristic, on
    // its own tick, and a later packet that omits it does not un-discover it.
    ride.ingestBleMetrics({ heartRate: 152, channels: { power: false, heartRate: true, cadence: false, speed: false } });
    expect(ride.telemetry.capability).toEqual({ power: true, heartRate: true, cadence: true });
  });

  it("computes rider-relative intensity without touching the effort ledger", async () => {
    const ride = await startRide({ rider: { ftp: 200, maxHr: 190, restingHr: 50 } });
    ride.ingestSimulatorMetrics({
      heartRate: 150,
      power: 200,
      cadence: 90,
      speed: 28,
      effort: 900,
    });

    const snapshot = useTelemetryStore.getState().snapshot;
    // 200 W against this rider's 200 W threshold is threshold pace.
    expect(snapshot.intensity).toBeGreaterThan(0.9);
    expect(snapshot.intensity).toBeLessThan(1.1);
    // The 0–1000 absolute score the reward ledger and the circuit read is
    // whatever the device said, untouched by any of this.
    expect(snapshot.effort).toBe(900);
  });

  // ─── The class clock and the route are two different things ────
  //
  // A real bike used to have no say in where the rider was on the route, and
  // the first attempt at fixing it (PR #50) bought that by speeding the class
  // itself, which capped a power-only bike at a quarter pace and so never let
  // it finish at all. What is locked below is the shape that avoids both: the
  // class advances on time for everyone, the route follows the rider, and the
  // route can only ever be a bounded head start ahead of the clock.

  const clockPercent = (seconds: number, durationSeconds = 60) =>
    (seconds / durationSeconds) * 100;

  /** An FTMS bike with no strap: watts and nothing else. */
  const wattsOnly = (powerW: number) => ({
    power: powerW,
    channels: { power: true, heartRate: false, cadence: false, speed: false },
  });

  /** A bike with no power meter, reporting a live heart rate. */
  const heartRateOnly = (bpm: number) => ({
    heartRate: bpm,
    channels: { power: false, heartRate: true, cadence: false, speed: false },
  });

  function planConfig(
    intervals: NonNullable<RideStartConfig["coachingConfig"]["workoutPlan"]>["intervals"],
  ): RideStartConfig["coachingConfig"] {
    return {
      ...rideConfig().coachingConfig,
      workoutPlan: {
        ...rideConfig().coachingConfig.workoutPlan!,
        id: "pace-plan",
        name: "Pace",
        intervals,
        totalDuration: intervals.reduce((sum, i) => sum + i.durationSeconds, 0),
      },
    };
  }

  const thresholdRider = { ftp: 200, maxHr: 190, restingHr: 50 };

  it("lets a power-only bike buy lead on the route without touching the class clock", async () => {
    const ride = await startRide({ rider: thresholdRider });

    for (let second = 1; second <= 10; second++) {
      // 250 W against this rider's 200 W threshold is a hard ride.
      ride.ingestBleMetrics(wattsOnly(250));
      await tick();

      const { elapsedTime, rideProgress } = useRideStore.getState();
      // The class does not care how hard they are going.
      expect(elapsedTime).toBe(second);
      // The route does.
      expect(rideProgress).toBeGreaterThan(clockPercent(second));
      // Bounded: five percent of whatever route is left, not of the class.
      const leadCapPct = clockPercent(0.05 * (60 - elapsedTime));
      expect(rideProgress).toBeLessThanOrEqual(clockPercent(second) + leadCapPct + 1e-9);
    }

    // ...and none of it is allowed to reach the 0–1000 reward ledger.
    expect(useTelemetryStore.getState().snapshot.effort).toBe(0);
    expect(useTelemetryStore.getState().snapshot.intensity).toBeGreaterThan(1.15);
  });

  it("finishes a power-only FTMS ride at the class clock and never before it", async () => {
    const ride = await startRide({ rider: thresholdRider });
    let firstFinishSecond = 0;

    for (let second = 1; second <= 60; second++) {
      // 1.5× threshold for a whole class — a Cat 1 rider on a hard night.
      ride.ingestBleMetrics(wattsOnly(300));
      await tick();
      const { rideProgress } = useRideStore.getState();
      if (rideProgress >= 100 - 1e-9 && firstFinishSecond === 0) firstFinishSecond = second;
      if (second < 60) expect(rideProgress).toBeLessThan(100);
    }

    // `rideProgress >= 100` is what both page.tsx and the analytics hook end a
    // ride on, so it has to become true exactly once and on the last tick.
    expect(firstFinishSecond).toBe(60);
    expect(useRideStore.getState().elapsedTime).toBe(60);
    expect(useRideStore.getState().rideProgress).toBeCloseTo(100, 6);
  });

  it("plays the cooldown to a rider who is already at the front", async () => {
    const phases: string[] = [];
    const ride = await startRide({
      rider: thresholdRider,
      coachingConfig: planConfig([
        { phase: "warmup", durationSeconds: 20, coachCue: "Roll" },
        { phase: "sprint", durationSeconds: 20, coachCue: "Go" },
        { phase: "cooldown", durationSeconds: 20, coachCue: "Down" },
      ]),
    });
    ride.bus.on("interval:changed", ({ phase }) => {
      phases.push(phase);
    });

    for (let second = 1; second <= 60; second++) {
      ride.ingestBleMetrics(wattsOnly(400));
      await tick();
    }

    // Effort buys distance, never a skip: a rider holding maximum lead through
    // the whole class still arrives at the cooldown, because the cooldown is a
    // time the class takes, not a distance the route covers.
    expect(phases).toEqual(["warmup", "sprint", "cooldown"]);
    expect(useRideStore.getState().elapsedTime).toBe(60);
  });

  it("moves the world for an HR-only device without writing the effort ledger", async () => {
    const ride = await startRide({ rider: thresholdRider });

    for (let second = 1; second <= 60; second++) {
      ride.ingestBleMetrics(heartRateOnly(185));
      await tick();

      const snapshot = useTelemetryStore.getState().snapshot;
      // Zone 4-ish: enough to be class pace, derived with no watts in sight.
      expect(snapshot.intensity).toBeGreaterThan(0.95);
      // The layering lock: effort stays zero for a device that never reported
      // it, however much the route moves.
      expect(snapshot.effort).toBe(0);

      const { elapsedTime, rideProgress } = useRideStore.getState();
      expect(rideProgress).toBeGreaterThanOrEqual(clockPercent(elapsedTime));
    }

    expect(useRideStore.getState().rideProgress).toBeCloseTo(100, 6);
  });

  it("never runs the route backwards when a surge gives way to a rest", async () => {
    const ride = await startRide({ rider: thresholdRider });
    let previous = 0;
    const schedule = [
      ...Array.from({ length: 20 }, () => 300),
      ...Array.from({ length: 20 }, () => 0), // stopped, at the top of their lead
      ...Array.from({ length: 20 }, () => 320),
    ];

    for (const powerW of schedule) {
      ride.ingestBleMetrics(wattsOnly(powerW));
      await tick();
      const { rideProgress } = useRideStore.getState();
      // Stopping costs a rider their head start gradually. It must never hand
      // it back as a step backwards: an interpolating marker or a latched story
      // beat cannot un-see a crossing.
      expect(rideProgress).toBeGreaterThanOrEqual(previous);
      previous = rideProgress;
    }

    expect(previous).toBeLessThanOrEqual(100 + 1e-9);
  });

  it("carries a rider with no signal at all on the class clock", async () => {
    await startRide();

    for (let second = 1; second <= 60; second++) {
      await tick();
      const { elapsedTime, rideProgress } = useRideStore.getState();
      // No evidence of effort is not evidence of rest: with no channels the
      // rider stays exactly with the class, which is what a dead bike today
      // does, and what keeps a dropout from looking like a penalty.
      expect(rideProgress).toBeCloseTo(clockPercent(elapsedTime), 6);
    }

    expect(useRideStore.getState().rideProgress).toBeCloseTo(100, 6);
  });
});
