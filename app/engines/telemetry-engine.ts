/**
 * TelemetryEngine — Manages real-time telemetry ingestion, W'bal calculation,
 * ghost state, and ride recording.
 *
 * Design rules:
 * - All real-time data stays in plain mutable refs (never React state).
 * - W'bal, ghost, and recording calculations happen here, not in useEffect.
 * - UI-relevant snapshots are flushed via EventBus at a throttled rate.
 * - Pure TS class — no React imports.
 */

import { EventBus } from "./event-bus";
import type {
  TelemetrySnapshot,
  TelemetryAverages,
  DeviceType,
  PerformanceTier,
  MultiGhostState,
} from "./types";
import {
  calculateNextWBal,
  DEFAULT_WBAL_CONFIG,
  getWBalPercentage,
  getGearRatio,
  calculateVirtualSpeed,
} from "@/app/lib/analytics/physiological-models";
import {
  calculateGhostState,
  fetchGhostWithFallback,
  type GhostPerformance,
  type GhostState,
} from "@/app/lib/analytics/ghost-service";
import type { RideRecordPoint } from "@/app/lib/analytics/ride-recorder";

const INITIAL_SNAPSHOT: TelemetrySnapshot = {
  heartRate: 0,
  power: 0,
  cadence: 0,
  speed: 0,
  effort: 0,
  wBal: DEFAULT_WBAL_CONFIG.wPrime,
  wBalPercentage: 100,
  currentGear: 10,
  gearRatio: 1.0,
  distance: 0,
  resistance: 0,
  timestamp: Date.now(),
};

export class TelemetryEngine {
  /** Mutable raw snapshot — the source of truth for current telemetry */
  rawSnapshot: TelemetrySnapshot = { ...INITIAL_SNAPSHOT };

  /** Ride recording points for TCX export */
  readonly ridePoints: RideRecordPoint[] = [];

  /** Telemetry samples for averages calculation */
  readonly samples: { hr: number; power: number; effort: number }[] = [];

  /** Current ghost state */
  ghostState: GhostState = { leadLagTime: 0, distanceGap: 0, ghostPoint: null };

  /** Ghost performance data (loaded async) */
  ghostPerformance: GhostPerformance | null = null;

  /** W'bal anaerobic capacity state */
  private wBal = DEFAULT_WBAL_CONFIG.wPrime;
  private wBalConfig = DEFAULT_WBAL_CONFIG;
  private lastWBalUpdateMs = 0;

  /** Adaptive commit rate state */
  private lastCommitMs = 0;
  private currentGear = 10;

  /** Config */
  private deviceType: DeviceType = "desktop";
  private performanceTier: PerformanceTier = "high";
  private routeCoordinates: Array<{ lat: number; lng: number; ele?: number }> = [];

  /** Elapsed seconds (set externally by lifecycle) */
  private elapsedSeconds = 0;

  /** Total ride duration in seconds (set in start()) */
  private totalDurationSeconds = 45 * 60;

  /** Multi-ghost performances (personal_best, leaderboard, instructor) */
  private multiGhostPerformances: GhostPerformance[] = [];

  /** Computed multi-ghost state (updated on each commit) */
  multiGhostState: MultiGhostState[] = [];

  /** Ghost fetch state */
  private ghostFetched = false;
  private multiGhostFetched = false;

  constructor(
    private readonly bus: EventBus,
    config?: { deviceType?: DeviceType; performanceTier?: PerformanceTier },
  ) {
    if (config?.deviceType) this.deviceType = config.deviceType;
    if (config?.performanceTier) this.performanceTier = config.performanceTier;
  }

  // ─── Lifecycle ────────────────────────────────────────────────

  start(
    routeCoords: Array<{ lat: number; lng: number; ele?: number }>,
    durationSeconds?: number,
  ): void {
    this.routeCoordinates = routeCoords;
    this.totalDurationSeconds = durationSeconds ?? 45 * 60;
    this.rawSnapshot = { ...INITIAL_SNAPSHOT };
    this.ridePoints.length = 0;
    this.samples.length = 0;
    this.wBal = DEFAULT_WBAL_CONFIG.wPrime;
    this.lastWBalUpdateMs = 0;
    this.lastCommitMs = 0;
    this.ghostFetched = false;
    this.multiGhostFetched = false;
    this.multiGhostPerformances = [];
    this.multiGhostState = [];
    this.ghostPerformance = null;
    this.elapsedSeconds = 0;
  }

  stop(): void {
    this.refreshAverages();
  }

  dispose(): void {
    this.ridePoints.length = 0;
    this.samples.length = 0;
    this.multiGhostPerformances = [];
    this.multiGhostState = [];
    this.ghostPerformance = null;
  }

  // ─── Data Ingestion ──────────────────────────────────────────

  /** Called by device engine when BLE data arrives */
  ingest(update: Partial<TelemetrySnapshot>): void {
    Object.assign(this.rawSnapshot, {
      heartRate: update.heartRate ?? this.rawSnapshot.heartRate,
      power: update.power ?? this.rawSnapshot.power,
      cadence: update.cadence ?? this.rawSnapshot.cadence,
      speed: update.speed ?? this.rawSnapshot.speed,
      effort: update.effort ?? this.rawSnapshot.effort,
      distance: update.distance ?? this.rawSnapshot.distance,
      timestamp: update.timestamp ?? Date.now(),
    });
  }

  /** Called directly for simulator updates (needs immediate UI feedback) */
  ingestSimulator(metrics: {
    heartRate: number;
    power: number;
    cadence: number;
    speed: number;
    effort: number;
    distance?: number;
    timestamp?: number;
  }): void {
    this.rawSnapshot = {
      ...this.rawSnapshot,
      ...metrics,
      distance: metrics.distance ?? this.rawSnapshot.distance,
      timestamp: metrics.timestamp ?? Date.now(),
    };
  }

  setElapsedSeconds(seconds: number): void {
    this.elapsedSeconds = seconds;
  }

  get elapsed(): number {
    return this.elapsedSeconds;
  }

  setCurrentGear(gear: number): void {
    this.currentGear = gear;
  }

  // ─── Commit to UI (called at throttled rate) ───────────────────

  /** Commits the current raw snapshot to the event bus for UI consumption.
   *  Returns the snapshot so the caller can also forward it to Zustand. */
  commit(): TelemetrySnapshot {
    const now = Date.now();
    const deltaSeconds =
      this.lastWBalUpdateMs > 0
        ? (now - this.lastWBalUpdateMs) / 1000
        : 0.25;

    this.lastWBalUpdateMs = now;
    this.lastCommitMs = now;

    // Update W'bal
    const nextWBal = calculateNextWBal(
      this.wBal,
      this.rawSnapshot.power,
      deltaSeconds,
      this.wBalConfig,
    );
    this.wBal = nextWBal;
    const percentage = getWBalPercentage(nextWBal, this.wBalConfig.wPrime);

    // Update virtual speed based on gear
    const { ratio } = getGearRatio(this.currentGear);
    const virtualSpeed = calculateVirtualSpeed(this.rawSnapshot.cadence, ratio);

    // Update snapshot
    this.rawSnapshot = {
      ...this.rawSnapshot,
      speed: virtualSpeed > 0 ? virtualSpeed : this.rawSnapshot.speed,
      distance:
        this.rawSnapshot.distance + (virtualSpeed * deltaSeconds) / 3600,
      wBal: nextWBal,
      wBalPercentage: percentage,
      currentGear: this.currentGear,
      gearRatio: ratio,
      timestamp: now,
    };

    // Record ride point at ~1Hz
    if (
      Math.round(now / 1000) !==
      Math.round((now - deltaSeconds * 1000) / 1000)
    ) {
      const coord = this.currentRouteCoordinate;
      this.ridePoints.push({
        timestamp: now,
        heartRate: this.rawSnapshot.heartRate,
        power: this.rawSnapshot.power,
        cadence: this.rawSnapshot.cadence,
        speed: this.rawSnapshot.speed,
        distance: this.rawSnapshot.distance,
        latitude: coord?.lat,
        longitude: coord?.lng,
        altitude: coord?.ele,
      });
      if (this.ridePoints.length > 10_800) {
        this.ridePoints.splice(0, this.ridePoints.length - 10_800);
      }
    }

    // Update single ghost
    if (this.ghostPerformance) {
      this.ghostState = calculateGhostState(
        this.ghostPerformance.points,
        this.rawSnapshot.distance * 1000,
        this.elapsedSeconds,
      );
    }

    // Update multi-ghost state
    this.updateMultiGhostState();

    // Collect sample for averages
    this.samples.push({
      hr: this.rawSnapshot.heartRate,
      power: this.rawSnapshot.power,
      effort: this.rawSnapshot.effort,
    });
    if (this.samples.length > 5_400) {
      this.samples.splice(0, this.samples.length - 5_400);
    }

    this.bus.emit("telemetry:committed", { ...this.rawSnapshot });
    return { ...this.rawSnapshot };
  }

  /** Returns the adaptive commit interval in ms based on device/performance tier */
  getCommitIntervalMs(): number {
    let hz: number;
    if (this.deviceType === "mobile") {
      hz =
        this.performanceTier === "low"
          ? 1
          : this.performanceTier === "medium"
            ? 2
            : 4;
    } else {
      hz =
        this.performanceTier === "low"
          ? 2
          : this.performanceTier === "medium"
            ? 5
            : 10;
    }
    return Math.floor(1000 / hz);
  }

  /** Whether enough time has passed since the last commit */
  shouldCommit(now: number): boolean {
    return now - this.lastCommitMs >= this.getCommitIntervalMs();
  }

  // ─── Ghost ─────────────────────────────────────────────────────

  async loadGhost(
    classId: string,
    ghostBlobId?: string,
    riderAddress?: string,
  ): Promise<void> {
    if (this.ghostFetched || this.routeCoordinates.length === 0) return;
    this.ghostFetched = true;

    try {
      this.ghostPerformance = await fetchGhostWithFallback(
        this.routeCoordinates,
        {
          classId,
          riderAddress,
          routeBlobId: ghostBlobId,
          ghostType: "personal_best",
        },
        25,
      );
    } catch {
      // Ghost is best-effort
      this.ghostPerformance = null;
    }
  }

  /** Loads multiple ghosts for the social riders UI (best-effort).
   *  Fetches 3 ghosts: personal_best, leaderboard, and instructor-level pacer. */
  async loadMultiGhost(
    classId: string,
    riderAddress?: string,
    ghostBlobId?: string,
  ): Promise<void> {
    if (this.multiGhostFetched || this.routeCoordinates.length === 0) return;
    this.multiGhostFetched = true;

    try {
      const [pb, leaderboard, pacer] = await Promise.all([
        fetchGhostWithFallback(
          this.routeCoordinates,
          { classId, riderAddress, routeBlobId: ghostBlobId, ghostType: "personal_best", riderName: "Your Best" },
          30,
        ),
        fetchGhostWithFallback(
          this.routeCoordinates,
          { classId, riderAddress, routeBlobId: ghostBlobId, ghostType: "leaderboard", riderName: "Peloton Avg" },
          25,
        ),
        fetchGhostWithFallback(
          this.routeCoordinates,
          { classId, ghostType: "instructor", riderName: "Gold Standard" },
          22,
        ),
      ]);
      this.multiGhostPerformances = [pb, leaderboard, pacer];
    } catch {
      this.multiGhostPerformances = [];
    }
  }

  /** Updates multiGhostState based on current rider telemetry.
   *  Called on every commit(). Uses binary search for O(log n) lookups. */
  private updateMultiGhostState(): void {
    if (this.multiGhostPerformances.length === 0) {
      this.multiGhostState = [];
      return;
    }

    const currentDistance = this.rawSnapshot.distance * 1000; // km → m
    const elapsed = this.elapsedSeconds;
    const elapsedMs = elapsed * 1000;

    this.multiGhostState = this.multiGhostPerformances.map((ghost) => {
      const points = ghost.points;
      const baseTs = points[0].timestamp;

      // Binary search: first point where (timestamp - base) >= elapsedMs
      let lo = 0, hi = points.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (points[mid].timestamp - baseTs >= elapsedMs) hi = mid;
        else lo = mid + 1;
      }
      const ghostPointAtTime = points[lo];

      // Binary search: first point where distance >= currentDistance (in km)
      const targetDist = currentDistance / 1000;
      lo = 0; hi = points.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (points[mid].distance >= targetDist) hi = mid;
        else lo = mid + 1;
      }
      const ghostPointAtDistance = points[lo];

      const ghostTimeAtDistance =
        (ghostPointAtDistance.timestamp - baseTs) / 1000;
      const leadLagTime = ghostTimeAtDistance - elapsed;
      const distanceGap = currentDistance - ghostPointAtTime.distance * 1000;

      return {
        id: ghost.id,
        name: ghost.riderName,
        leadLagTime,
        distanceGap,
        active: true,
        power: ghostPointAtTime.power,
      } as MultiGhostState;
    });
  }

  // ─── Averages ──────────────────────────────────────────────────

  refreshAverages(): TelemetryAverages {
    const samples = this.samples;
    if (samples.length === 0) {
      return { avgHr: 0, avgPower: 0, avgEffort: 0 };
    }
    const sum = samples.reduce(
      (acc, s) => ({
        hr: acc.hr + s.hr,
        power: acc.power + s.power,
        effort: acc.effort + s.effort,
      }),
      { hr: 0, power: 0, effort: 0 },
    );
    return {
      avgHr: Math.round(sum.hr / samples.length),
      avgPower: Math.round(sum.power / samples.length),
      avgEffort: Math.round(sum.effort / samples.length),
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────

  private get currentRouteCoordinate() {
    if (this.routeCoordinates.length === 0) return null;
    const progress =
      this.totalDurationSeconds > 0
        ? Math.min(1, this.elapsedSeconds / this.totalDurationSeconds)
        : 0;
    const index = Math.min(
      this.routeCoordinates.length - 1,
      Math.max(0, Math.round(progress * (this.routeCoordinates.length - 1))),
    );
    return this.routeCoordinates[index] ?? null;
  }
}
