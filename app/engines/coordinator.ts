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
import { useRideStore } from "@/app/stores/ride-store";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { useCoachingStore } from "@/app/stores/coaching-store";
import { useRewardsStore } from "@/app/stores/rewards-store";
import {
  getCurrentInterval,
  getIntervalProgress,
  getIntervalRemaining,
} from "@/app/lib/workout-plan";

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
  private unsubTick: (() => void) | null = null;
  private eventUnsubs: Array<() => void> = [];
  private rafRunning = false;
  private sampleTimerId: ReturnType<typeof setInterval> | null = null;
  private styleOverrideHandler: EventListener | null = null;

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
      // Simulator needs immediate commit for responsive UI
      const snapshot = this.telemetry.commit();
      this.bridgeSnapshotToStore(snapshot);
    };
  }

  // ─── Lifecycle ─────────────────────────────────────────────────

  async start(config: RideStartConfig): Promise<void> {
    this.config = config;

    // Configure engines
    const routeCoordinates =
      config.classData?.route?.route?.coordinates ?? [];
    const durationSeconds = (config.classData?.metadata?.duration ?? 45) * 60;

    this.telemetry.start(routeCoordinates, durationSeconds);

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

    // Wire cross-engine events
    this.unsubTick = this.bus.on("lifecycle:tick", ({ elapsed, progress }) => {
      this.telemetry.setElapsedSeconds(elapsed);
      this.coaching.onTick(elapsed, progress);
    });

    // Start RAF commit loop (single loop, no mixed timers)
    this.startCommitLoop();

    // Start collecting telemetry samples at 1Hz
    this.sampleTimerId = setInterval(() => {
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
    }, 1000);

    // Configure rewards engine
    this.rewards.updateConfig({
      mode: config.rewardMode,
      classId: config.classId,
      instructor: ("0x0" as `0x${string}`),
    });

    // Start audio engine (mixer init, EventBus subscriptions)
    this.audio.start().catch((err) =>
      console.warn("[Coordinator] AudioEngine start failed:", err),
    );

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
    this.sui.stop();
    this.telemetry.stop();

    // End Local Oracle session — generates ZK proof + stores encrypted telemetry to Walrus
    this.oracle.endSession().catch((err) =>
      console.warn("[Coordinator] LocalOracle endSession failed:", err),
    );

    // Finalize averages in telemetry-store
    const averages = this.telemetry.refreshAverages();
    useTelemetryStore.setState({ averages });

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

  pause(): void {
    useRideStore.setState({ isPaused: true });
    this.bus.emit("ride:paused", {});
  }

  resume(): void {
    useRideStore.setState({ isPaused: false });
    this.bus.emit("ride:resumed", {});
  }

  dispose(): void {
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
    // Simulator needs immediate commit for responsive UI
    const snapshot = this.telemetry.commit();
    this.bridgeSnapshotToStore(snapshot);
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
    this.coaching.onTelemetry(
      snapshot.cadence,
      this.coaching.currentIntervalIndex,
      "",
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

    // Update rolling history arrays for performance graphs (last 60 samples)
    const prevHistory = useTelemetryStore.getState().history;
    const MAX_HISTORY = 60;
    storeUpdate.history = {
      power: [...prevHistory.power, snapshot.power].slice(-MAX_HISTORY),
      cadence: [...prevHistory.cadence, snapshot.cadence].slice(-MAX_HISTORY),
      heartRate: [...prevHistory.heartRate, snapshot.heartRate].slice(-MAX_HISTORY),
    };

    // Update recentPower for focus view power trend (last 30 samples)
    storeUpdate.recentPower = [...useTelemetryStore.getState().recentPower, snapshot.power].slice(-30);

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
