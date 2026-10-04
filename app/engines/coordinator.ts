/**
 * RideCoordinator — Orchestrates all engines for a ride session.
 *
 * Responsibilities:
 * - Wires engines together through the EventBus (engines never import each other)
 * - Owns the start/stop/pause/dispose lifecycle
 * - Bridges engine state to Zustand stores for UI consumption
 * - Instantiates engines with their dependencies
 *
 * Usage (in page.tsx):
 *   const coordinator = new RideCoordinator();
 *   await coordinator.start(config);
 *   // ... ride happens ...
 *   const { summary } = await coordinator.stop();
 *   coordinator.dispose();
 */

import { EventBus } from "./event-bus";
import { TelemetryEngine } from "./telemetry-engine";
import { DeviceEngine } from "./device-engine";
import { CoachingEngine } from "./coaching-engine";
import { AudioEngine } from "./audio-engine";
import { RewardsEngine } from "./rewards-engine";
import { VisualizationEngine } from "./visualization-engine";
import { SuiEngine } from "./sui-engine";
import { getLocalOracle } from "@/app/lib/zk/oracle";
import type { RideStartConfig, TelemetrySnapshot } from "./types";
import { PRACTICE_WALL_DURATION_SEC } from "@/app/lib/practice-demo";
import { useRideStore } from "@/app/stores/ride-store";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { useCoachingStore } from "@/app/stores/coaching-store";
import { useRewardsStore } from "@/app/stores/rewards-store";
import {
  getCurrentInterval,
  getIntervalProgress,
  getIntervalRemaining,
} from "@/app/lib/workout-plan";
import {
  createInitialMemory,
  loadCoachMemory,
  saveCoachMemory,
  updateMemoryAfterRide,
} from "@/app/lib/walrus/coach-memory";

export class RideCoordinator {
  readonly bus: EventBus;
  readonly telemetry: TelemetryEngine;
  readonly device: DeviceEngine;
  readonly coaching: CoachingEngine;
  readonly audio: AudioEngine;
  readonly rewards: RewardsEngine;
  readonly visualization: VisualizationEngine;
  readonly sui: SuiEngine;
  private oracle = getLocalOracle();

  private config: RideStartConfig | null = null;
  private durationSeconds = 45 * 60;
  // Class-seconds advanced per wall-clock second. Practice/demo rides
  // compress the full class into a 30–60s window (see WEDGE.md's
  // "core loop under 30 seconds" rule); real-device rides run at 1x.
  private clockScale = 1;
  // Class-seconds of route progress accumulated from rider effort.
  // elapsedTime stays on clockScale so intervals and coaching run on
  // time; position on the route responds to pedaling on every ride.
  private progressElapsed = 0;
  private unsubTick: (() => void) | null = null;
  private eventUnsubs: Array<() => void> = [];
  private rafRunning = false;
  private sampleTimerId: ReturnType<typeof setInterval> | null = null;
  /** Last wall-clock write of trend arrays (history/recentPower). Graphs and
   *  power trends read fine at 2Hz; writing them at the full commit rate
   *  (up to 10Hz) reallocates arrays and re-renders subscribers for no
   *  visible gain — a cheap source of ride judder. */
  private lastTrendWriteMs = 0;
  private styleOverrideHandler: EventListener | null = null;
  /** Rider+coach pair the coach memory is loaded/saved under (Walrus blob pointer). */
  private memoryKey: { riderId: string; coachId: string } | null = null;

  constructor() {
    this.bus = new EventBus();
    this.telemetry = new TelemetryEngine(this.bus);
    this.device = new DeviceEngine(this.bus);
    this.coaching = new CoachingEngine(this.bus);
    this.audio = new AudioEngine(this.bus);
    this.rewards = new RewardsEngine(this.bus, {
      mode: "zk-batch",
      classId: "",
      instructor: "0x0" as `0x${string}`,
    });
    this.visualization = new VisualizationEngine(this.bus);
    this.sui = new SuiEngine(this.bus);

    // Wire device → telemetry ingestion
    this.device.onTelemetry = (update) => {
      this.telemetry.ingest(update);
    };

    this.device.onSimulatorTelemetry = (update) => {
      this.telemetry.ingestSimulator(update as Parameters<TelemetryEngine["ingestSimulator"]>[0]);
      // Simulator input fires per keydown/auto-repeat — far faster than the commit
      // budget. Committing synchronously here ran the full pipeline + a store write
      // per input event. Route it through the same throttle as the rAF loop.
      if (this.telemetry.shouldCommit(Date.now())) {
        this.bridgeSnapshotToStore(this.telemetry.commit());
      }
    };
  }

  // ─── Lifecycle ─────────────────────────────────────────────────

  /**
   * Starts the ride session. A coordinator instance is single-use: the
   * coordinator hook creates a fresh instance per ride and disposes the old
   * one, so a second start() on the same instance means a double-start bug
   * upstream (leaked 1Hz clock timer, doubled EventBus writes). Guard and
   * log instead of leaking.
   */
  private started = false;
  private disposed = false;

  async start(config: RideStartConfig): Promise<void> {
    if (this.started || this.disposed) {
      console.warn("[Coordinator] start() ignored — instance already started or disposed");
      return;
    }
    this.started = true;
    this.config = config;

    // Configure engines
    const routeCoordinates =
      config.classData?.route?.route?.coordinates ?? [];
    this.durationSeconds = (config.classData?.metadata?.duration ?? 45) * 60;

    // Practice/demo rides play the whole class in ~PRACTICE_WALL_DURATION_SEC
    // wall-clock seconds regardless of the class's real duration (clamped so
    // a short class never plays slower than real time). A custom wall-clock
    // duration can be supplied via config.practiceWallDurationSec.
    const wallDuration = config.practiceWallDurationSec ?? PRACTICE_WALL_DURATION_SEC;
    this.clockScale = config.isPracticeMode
      ? Math.max(1, this.durationSeconds / wallDuration)
      : 1;
    this.progressElapsed = 0;

    this.telemetry.start(routeCoordinates, this.durationSeconds);

    if (config.isPracticeMode) {
      this.device.connectSimulator("Simulator active — use arrow keys to pedal");
    }

    // Configure coaching engine
    this.coaching.start({
      agentName: config.coachingConfig.agentName,
      personality: config.coachingConfig.personality,
      workoutPlan: config.coachingConfig.workoutPlan,
      aiActive: config.coachingConfig.aiActive,
      storyBeats: config.classData?.route?.route?.storyBeats,
    });

    // Coach voice matches the class's coaching personality (AudioEngine's
    // "drill" vs coaching's "drill-sergeant" vocabulary).
    this.audio.updateConfig({
      personality:
        config.coachingConfig.personality === "drill-sergeant"
          ? "drill"
          : config.coachingConfig.personality,
    });

    // Cross-session coach memory (Walrus blob, system_prompt_cid pattern).
    // Loads async; the engine greets from it a few seconds into the ride.
    this.memoryKey = {
      riderId: config.address ?? "guest",
      coachId: `${config.coachingConfig.agentName}:${config.coachingConfig.personality}`,
    };
    loadCoachMemory(this.memoryKey.riderId, this.memoryKey.coachId)
      .then((memory) => {
        if (memory) {
          this.coaching.updateConfig({ memory });
          console.log(
            `[Coordinator] Coach memory loaded for ${this.memoryKey?.coachId}: ${memory.rides} prior ride(s)`,
          );
        }
      })
      .catch((err) => console.warn("[Coordinator] Coach memory load failed:", err));

    // Wire cross-engine events
    this.unsubTick = this.bus.on("lifecycle:tick", ({ elapsed, progress }) => {
      this.telemetry.setElapsedSeconds(elapsed);
      this.coaching.onTick(elapsed, progress);
    });

    // Start RAF commit loop (single loop, no mixed timers)
    this.startCommitLoop();

    // Start collecting telemetry samples at 1Hz. This timer is the single
    // ride clock for every ride mode (device, keyboard sim, practice): it
    // is the only writer of elapsedTime/rideProgress below.
    this.sampleTimerId = setInterval(() => {
      if (!useRideStore.getState().isActive) return;
      const snapshot = this.telemetry.rawSnapshot;
      this.telemetry.samples.push({
        hr: snapshot.heartRate,
        power: snapshot.power,
        effort: snapshot.effort,
      });
      if (this.telemetry.samples.length > 5_400) {
        this.telemetry.samples.splice(0, this.telemetry.samples.length - 5_400);
      }

      // Feed LocalOracle for 10-min rolling buffer + Walrus encrypted backup
      this.oracle.addTelemetry({
        timestamp: Date.now(),
        heartRate: snapshot.heartRate,
        power: snapshot.power,
        cadence: snapshot.cadence,
      });

      // Feed the rewards engine (no-op unless earning is active). Skip
      // no-signal samples so idle time doesn't accrue base reward.
      // Note: Noir circuits expect integer field elements (BigInt()), so
      // telemetry values must be floored — raw sensor data can be floats
      // (e.g., 205.8, 357.2 from the power accumulator).
      if (snapshot.heartRate > 0 || snapshot.power > 0) {
        void this.rewards.recordEffort({
          timestamp: Date.now(),
          heartRate: Math.floor(snapshot.heartRate),
          power: Math.floor(snapshot.power),
          cadence: snapshot.cadence,
        });
      }

      // Advance the class clock and route progress. This 1Hz timer is the
      // single ride-clock writer (ARCHITECTURE.md Rule 6). elapsedTime
      // always steps by clockScale so intervals and coaching stay on time.
      // rideProgress is effort-scaled on every ride: one multiply per
      // second, then the frame loop keeps reading the same stored value.
      // PedalSimulator idle-settles at effort ~100, so <150 reads as
      // "stopped". ~350 (steady pedaling) is 1x class pace; hard pedaling
      // caps at 1.6x.
      const elapsed = Math.min(
        useRideStore.getState().elapsedTime + this.clockScale,
        this.durationSeconds,
      );
      const effort = snapshot.effort; // 0–1000
      const factor = effort < 150 ? 0 : Math.min((effort - 150) / 200, 1.6);
      this.progressElapsed = Math.min(
        this.progressElapsed + this.clockScale * factor,
        this.durationSeconds,
      );
      const progress = Math.min((this.progressElapsed / this.durationSeconds) * 100, 100);
      useRideStore.setState({ elapsedTime: elapsed, rideProgress: progress });

      // Drive the interval/coaching clock for both device paths
      this.bus.emit("lifecycle:tick", { elapsed: elapsed, progress: progress });
    }, 1000);

    // Configure rewards engine
    this.rewards.updateConfig({
      mode: config.rewardMode,
      classId: config.classId,
      instructor: ("0x0" as `0x${string}`),
    });
    useRewardsStore.setState({
      mode: config.rewardMode,
      isActive: false,
      accumulatedReward: BigInt(0),
      formattedReward: "0",
      streamingRate: 0,
      streamState: null,
    });
    // Yellow streaming needs a wallet-signed channel and is opened by the
    // rewards hook; the other modes start engine-side so the live HUD accrues.
    if (config.rewardMode !== "yellow-stream") {
      this.rewards.startEarning().catch((err) =>
        console.warn("[Coordinator] Rewards start failed:", err),
      );
    }

    // Start audio engine (mixer init, EventBus subscriptions)
    this.audio.start().catch((err) =>
      console.warn("[Coordinator] AudioEngine start failed:", err),
    );

    // Prewarm the TTS caches for this ride's scripted cues (interval
    // coachCues, story beat labels) during the warmup phase so interval
    // transitions speak with zero perceived latency. Fire-and-forget.
    const cueTexts = [
      ...(config.coachingConfig.workoutPlan?.intervals ?? [])
        .map((interval) => interval.coachCue)
        .filter((cue): cue is string => Boolean(cue && cue.trim().length > 0)),
      ...(config.classData?.route?.route?.storyBeats ?? [])
        .map((beat) => beat?.label)
        .filter((label): label is string => Boolean(label && label.trim().length > 0)),
    ];
    if (cueTexts.length > 0) {
      void this.audio.prewarm(cueTexts);
    }

    // Start Local Oracle for on-device proof generation
    this.oracle.startSession({
      classId: config.classId,
      riderId: config.address ?? "guest",
      startTime: Date.now(),
      targetHeartRate: 150,
      minDuration: 300,
    });

    // Start Sui engine (subscribe to telemetry:committed events)
    this.sui.start();

    // Start visualization engine (GPU probe + FPS monitoring)
    this.visualization.start();

    // Load single ghost data (async, best-effort)
    this.telemetry.loadGhost(
      config.classId,
      config.ghostBlobId,
      config.address,
    );

    // Load multi-ghost data (social riders UI)
    this.telemetry.loadMultiGhost(config.classId, config.address, config.ghostBlobId);

    // Bridge window CustomEvent → EventBus for style overrides
    this.styleOverrideHandler = ((e: Event) => {
      const detail = (e as CustomEvent).detail;
      this.bus.emit("coaching:style-override", detail);
    }) as EventListener;
    window.addEventListener("spinchain:style-override", this.styleOverrideHandler);

    // Wire EventBus → domain stores for UI consumption
    this.wireStoresToEventBus();

    // Update Zustand store with initial state
    useRideStore.setState({
      isActive: true,
      session: {
        id: `${config.classId}-${Date.now()}`,
        classId: config.classId,
        className:
          config.classData?.metadata?.name || config.coachingConfig.agentName,
        instructor: config.coachingConfig.agentName,
        startTime: Date.now(),
        duration: config.classData?.metadata?.duration ?? 45,
        isPractice: config.isPracticeMode,
      },
    });

    // Reset telemetry history so stale data from a previous ride doesn't bleed in
    useTelemetryStore.setState({
      history: { power: [], cadence: [], heartRate: [] },
      recentPower: [],
    });
  }

  async stop(): Promise<void> {
    this.rafRunning = false;
    this.clearTimers();
    this.audio.stop();
    this.rewards.stop();
    useRewardsStore.setState({ isActive: false });
    this.sui.stop();
    this.telemetry.stop();

    // End Local Oracle session — generates ZK proof + stores encrypted telemetry to Walrus
    this.oracle.endSession().catch((err) =>
      console.warn("[Coordinator] LocalOracle endSession failed:", err),
    );

    // Finalize averages in telemetry-store
    const averages = this.telemetry.refreshAverages();
    useTelemetryStore.setState({ averages });

    // Persist cross-session coach memory (Walrus blob; best-effort)
    this.persistCoachMemory(averages).catch((err) =>
      console.warn("[Coordinator] Coach memory save failed:", err),
    );

    // Clear coaching UI state
    useCoachingStore.setState({
      lastCoachMessage: null,
      isSpeaking: false,
    });

    this.telemetry.dispose();

    useRideStore.setState({ isActive: false });

    document.body.classList.remove("ride-active");

    this.visualization.stop();
  }

  /**
   * Fold the finished ride into the rider's coach memory and persist it
   * as a new Walrus blob (pointer advances; falls back to a flagged local
   * cache when Walrus is unreachable). Best-effort — never blocks stop().
   */
  private async persistCoachMemory(
    averages: ReturnType<TelemetryEngine["refreshAverages"]>,
  ): Promise<void> {
    if (!this.memoryKey) return;
    // Skip rides with no real effort data (opened and closed the class).
    if (averages.avgPower <= 0 && averages.avgEffort <= 0) return;

    const { riderId, coachId } = this.memoryKey;
    const existing =
      (await loadCoachMemory(riderId, coachId)) ??
      createInitialMemory(riderId, coachId);

    const summary = {
      avgPower: averages.avgPower,
      durationSec: Math.round(useRideStore.getState().elapsedTime),
      completed: useRideStore.getState().rideProgress >= 95,
    };
    const note =
      existing.bestAvgPower > 0 && summary.avgPower > existing.bestAvgPower
        ? "New best average power"
        : undefined;

    const memory = updateMemoryAfterRide(existing, summary, note);
    const result = await saveCoachMemory(memory);
    if (result.persisted === "local") {
      console.warn("[Coordinator] Coach memory cached locally; Walrus unreachable");
    }
  }

  pause(): void {
    useRideStore.setState({ isPaused: true });
    this.bus.emit("ride:paused", {});
  }

  resume(): void {
    useRideStore.setState({ isPaused: false });
    this.bus.emit("ride:resumed", {});
  }

  dispose(): void {
    this.disposed = true;
    this.rafRunning = false;
    this.clearTimers();
    this.telemetry.dispose();
    this.device.dispose();
    this.audio.dispose();
    this.rewards.dispose();
    this.sui.dispose();
    this.visualization.dispose();
    if (this.unsubTick) {
      this.unsubTick();
      this.unsubTick = null;
    }
    this.eventUnsubs.forEach((fn) => fn());
    this.eventUnsubs = [];
    if (this.styleOverrideHandler) {
      window.removeEventListener("spinchain:style-override", this.styleOverrideHandler);
      this.styleOverrideHandler = null;
    }
    this.bus.dispose();
    document.body.classList.remove("ride-active");
  }

  // ─── External Data Ingestion ─────────────────────────────────

  /** Direct ingestion point for BLE metrics (called from useRideCoordinator hook) */
  ingestBleMetrics(metrics: Partial<TelemetrySnapshot>): void {
    this.telemetry.ingest(metrics);
  }

  /** Direct ingestion point for simulator metrics */
  ingestSimulatorMetrics(metrics: {
    heartRate: number;
    power: number;
    cadence: number;
    speed: number;
    effort: number;
    distance?: number;
    timestamp?: number;
  }): void {
    this.telemetry.ingestSimulator(metrics);
    // Throttle commits the same way as the rAF loop (see onSimulatorTelemetry):
    // keyboard/on-screen pedal events can fire many times per second.
    if (this.telemetry.shouldCommit(Date.now())) {
      this.bridgeSnapshotToStore(this.telemetry.commit());
    }
  }

  /** Set current gear (called from UI gear shift buttons) */
  setCurrentGear(gear: number): void {
    this.telemetry.setCurrentGear(gear);
  }

  /** Set elapsed seconds (synced from UI timer) */
  setElapsedSeconds(seconds: number): void {
    this.telemetry.setElapsedSeconds(seconds);
  }

  // ─── Commit Loop (single RAF) ────────────────────────────────

  private startCommitLoop(): void {
    this.rafRunning = true;

    const loop = () => {
      if (!this.rafRunning) return;

      if (useRideStore.getState().isActive) {
        const now = Date.now();
        if (this.telemetry.shouldCommit(now)) {
          const snapshot = this.telemetry.commit();
          this.bridgeSnapshotToStore(snapshot);
        }
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  private bridgeSnapshotToStore(snapshot: ReturnType<TelemetryEngine["commit"]>): void {
    const idx = this.coaching.currentIntervalIndex;
    const phase =
      this.coaching.coachingConfig.workoutPlan?.intervals?.[idx]?.phase ?? "";
    this.coaching.onTelemetry(
      {
        cadence: snapshot.cadence,
        power: snapshot.power,
        heartRate: snapshot.heartRate,
        wBalPercentage: snapshot.wBalPercentage,
      },
      idx,
      phase,
    );

    // Write snapshot — components use granular selectors (s.snapshot.heartRate)
    // so new object identity is fine; Zustand compares returned primitives.
    const storeUpdate: Record<string, unknown> = { snapshot };

    // Only write ghost state when values actually changed (avoids new object ref → re-render)
    const prevGhost = useTelemetryStore.getState().ghostState;
    const nextGhost = this.telemetry.ghostState;
    if (
      prevGhost.leadLagTime !== nextGhost.leadLagTime ||
      prevGhost.distanceGap !== nextGhost.distanceGap ||
      prevGhost.ghostPoint !== nextGhost.ghostPoint
    ) {
      storeUpdate.ghostState = { ...nextGhost };
    }

    // Only write multi-ghost state when the array length or any entry changed
    const prevMulti = useTelemetryStore.getState().multiGhostState;
    const nextMulti = this.telemetry.multiGhostState;
    if (
      prevMulti.length !== nextMulti.length ||
      nextMulti.some((g, i) => {
        const p = prevMulti[i];
        return !p || p.leadLagTime !== g.leadLagTime || p.distanceGap !== g.distanceGap;
      })
    ) {
      storeUpdate.multiGhostState = [...nextMulti];
    }

    // Rolling history arrays for performance graphs (last 60 samples) —
    // throttled to 2Hz (see lastTrendWriteMs). Live numbers and flow input
    // still commit at full rate above; only trend consumers slow down.
    const nowMs = Date.now();
    if (nowMs - this.lastTrendWriteMs >= 500) {
      this.lastTrendWriteMs = nowMs;
      const prevHistory = useTelemetryStore.getState().history;
      const MAX_HISTORY = 60;
      storeUpdate.history = {
        power: [...prevHistory.power, snapshot.power].slice(-MAX_HISTORY),
        cadence: [...prevHistory.cadence, snapshot.cadence].slice(-MAX_HISTORY),
        heartRate: [...prevHistory.heartRate, snapshot.heartRate].slice(-MAX_HISTORY),
      };

      // recentPower for focus view power trend (last 30 samples)
      storeUpdate.recentPower = [...useTelemetryStore.getState().recentPower, snapshot.power].slice(-30);
    }

    useTelemetryStore.setState(storeUpdate as never);

    // Update interval progress in coaching-store (skip if unchanged)
    const plan = this.coaching.coachingConfig.workoutPlan;
    if (plan) {
      const elapsed = this.telemetry.elapsed;
      const idx = getCurrentInterval(plan.intervals, elapsed);
      const progress = getIntervalProgress(plan.intervals, elapsed);
      const remaining = getIntervalRemaining(plan.intervals, elapsed);
      const prev = useCoachingStore.getState();
      if (
        prev.currentIntervalIndex !== idx ||
        Math.abs(prev.intervalProgress - progress) > 0.01
      ) {
        const interval = plan.intervals[idx] ?? null;
        useCoachingStore.setState({
          currentInterval: interval,
          currentIntervalIndex: idx,
          intervalProgress: progress,
          intervalRemaining: remaining,
        });
      }
    }
  }

  /** Subscribes to EventBus events and writes to the domain Zustand stores */
  private wireStoresToEventBus(): void {
    this.eventUnsubs.push(
      this.bus.on("coaching:message", (data) => {
        useCoachingStore.setState({ lastCoachMessage: data.text });
      }),
    );

    this.eventUnsubs.push(
      this.bus.on("audio:speaking", (data) => {
        useCoachingStore.setState({ isSpeaking: data.isSpeaking });
      }),
    );

    this.eventUnsubs.push(
      this.bus.on("interval:changed", (data) => {
        useCoachingStore.setState({
          currentIntervalIndex: data.index,
          currentInterval: data.interval as never,
        });
      }),
    );

    this.eventUnsubs.push(
      this.bus.on("rewards:tick", (data) => {
        const elapsedSeconds = useRideStore.getState().elapsedTime;
        const elapsedMinutes = elapsedSeconds / 60;
        const streamingRate = elapsedMinutes > 0
          ? Number(data.accumulated) / 1e18 / elapsedMinutes
          : 0;

        useRewardsStore.setState({
          accumulatedReward: data.accumulated,
          formattedReward: this.rewards.formattedReward,
          streamingRate,
        });
      }),
    );

    this.eventUnsubs.push(
      this.bus.on("rewards:started", () => {
        useRewardsStore.setState({ isActive: true });
      }),
    );

    this.eventUnsubs.push(
      this.bus.on("rewards:finalized", () => {
        useRewardsStore.setState({ isActive: false });
      }),
    );
  }

  private clearTimers(): void {
    if (this.sampleTimerId) {
      clearInterval(this.sampleTimerId);
      this.sampleTimerId = null;
    }
  }
}
