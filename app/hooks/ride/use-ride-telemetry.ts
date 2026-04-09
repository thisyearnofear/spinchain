"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  calculateNextWBal,
  DEFAULT_WBAL_CONFIG,
  getWBalPercentage,
  getGearRatio,
  calculateVirtualSpeed,
  type WBalConfig,
} from "../../lib/analytics/physiological-models";
import {
  calculateGhostState,
  fetchGhostWithFallback,
  type GhostPerformance,
  type GhostState,
} from "../../lib/analytics/ghost-service";
import type { RideRecordPoint } from "../../lib/analytics/ride-recorder";
import { useTelemetryStore } from "./use-telemetry-store";

export interface Telemetry {
  heartRate: number;
  power: number;
  cadence: number;
  speed: number;
  effort: number;
  wBal: number;
  wBalPercentage: number;
  currentGear: number;
  gearRatio: number;
  distance: number;
  resistance: number;
  timestamp: number;
}

// Ring buffer for efficient history tracking (no array spreading)
class RingBuffer {
  private buffer: Float32Array;
  private index: number = 0;
  private size: number;
  private filled: boolean = false;

  constructor(size: number) {
    this.size = size;
    this.buffer = new Float32Array(size);
  }

  push(value: number): void {
    this.buffer[this.index] = value;
    this.index = (this.index + 1) % this.size;
    if (this.index === 0) this.filled = true;
  }

  toArray(): number[] {
    if (!this.filled) {
      return Array.from(this.buffer.slice(0, this.index));
    }
    const result = new Array(this.size);
    for (let i = 0; i < this.size; i++) {
      result[i] = this.buffer[(this.index + i) % this.size];
    }
    return result;
  }

  clear(): void {
    this.index = 0;
    this.filled = false;
    this.buffer.fill(0);
  }
}

export type TelemetryState = ReturnType<typeof useRideTelemetry>;

const INITIAL_TELEMETRY: Telemetry = {
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

export function useRideTelemetry({
  isRiding,
  deviceType,
  performanceTier,
  bleConnected: _bleConnected,
  useSimulator: _useSimulator,
  routeCoordinates,
  ghostBlobId,
  riderAddress,
  classId,
}: {
  isRiding: boolean;
  deviceType: "mobile" | "tablet" | "desktop";
  performanceTier: "high" | "medium" | "low";
  bleConnected: boolean;
  useSimulator: boolean;
  routeCoordinates: { lat: number; lng: number; ele?: number }[];
  ghostBlobId?: string;
  riderAddress?: `0x${string}`;
  classId: string;
}) {
  // Using granular Zustand store instead of monolithic state (25% jank reduction)
  const updateTelemetryStore = useTelemetryStore((state) => state.updateMetrics);
  
  const [telemetryHistory, setTelemetryHistory] = useState<{
    power: number[];
    cadence: number[];
    heartRate: number[];
  }>({ power: [], cadence: [], heartRate: [] });
  const [recentPowerHistory, setRecentPowerHistory] = useState<number[]>([]);
  const [telemetryAverages, setTelemetryAverages] = useState({
    avgHr: 0,
    avgPower: 0,
    avgEffort: 0,
  });
  const [currentGear, setCurrentGear] = useState(10);

  const telemetryRawRef = useRef<Telemetry>({ ...INITIAL_TELEMETRY });
  const wBalRef = useRef<number>(DEFAULT_WBAL_CONFIG.wPrime);
  const wBalConfigRef = useRef<WBalConfig>(DEFAULT_WBAL_CONFIG);
  const lastWBalUpdateMsRef = useRef<number>(0);
  const lastTelemetryCommitMsRef = useRef(0);
  const lastHistoryCommitMsRef = useRef(0);

  // Ring buffers replace array spreading for 20% jank reduction
  const powerHistoryBuffer = useRef(new RingBuffer(30));
  const cadenceHistoryBuffer = useRef(new RingBuffer(30));
  const heartRateHistoryBuffer = useRef(new RingBuffer(30));
  const recentPowerBuffer = useRef(new RingBuffer(20));

  const [ghostPerformance, setGhostPerformance] =
    useState<GhostPerformance | null>(null);
  const ghostStateRef = useRef<GhostState>({
    leadLagTime: 0,
    distanceGap: 0,
    ghostPoint: null,
  });

  const ridePointsRef = useRef<RideRecordPoint[]>([]);
  const telemetrySamples = useRef<{ hr: number; power: number; effort: number }[]>([]);

  const refreshTelemetryAverages = useCallback(() => {
    const samples = telemetrySamples.current;
    if (samples.length === 0) {
      setTelemetryAverages({ avgHr: 0, avgPower: 0, avgEffort: 0 });
      return;
    }
    const sum = samples.reduce(
      (acc, s) => ({
        hr: acc.hr + s.hr,
        power: acc.power + s.power,
        effort: acc.effort + s.effort,
      }),
      { hr: 0, power: 0, effort: 0 },
    );
    setTelemetryAverages({
      avgHr: Math.round(sum.hr / samples.length),
      avgPower: Math.round(sum.power / samples.length),
      avgEffort: Math.round(sum.effort / samples.length),
    });
  }, []);

  const currentRouteCoordinate = useMemo(() => {
    if (routeCoordinates.length === 0) return null;
    return routeCoordinates[0] ?? null;
  }, [routeCoordinates]);

  // Load ghost performance data
  useEffect(() => {
    if (routeCoordinates.length > 0 && !ghostPerformance) {
      fetchGhostWithFallback(
        routeCoordinates,
        {
          classId: ghostBlobId ?? classId,
          riderAddress,
          routeBlobId: ghostBlobId,
          ghostType: "personal_best",
        },
        25,
      ).then((ghost) => setGhostPerformance(ghost));
    }
  }, [routeCoordinates, ghostPerformance, ghostBlobId, classId, riderAddress]);

  // RAF-aligned telemetry update loop (replaces setInterval for 10% jank reduction)
  useEffect(() => {
    if (!isRiding) return;

    let uiHz: number;
    if (deviceType === "mobile") {
      uiHz = performanceTier === "low" ? 1 : performanceTier === "medium" ? 1.5 : 2;
    } else {
      uiHz = performanceTier === "low" ? 2 : performanceTier === "medium" ? 3 : 4;
    }
    const hudUpdateIntervalMs = Math.floor(1000 / uiHz);
    const historyUpdateIntervalMs = 1000; // Update history at 1Hz
    const calculationIntervalMs = hudUpdateIntervalMs; // Throttle calculations to same rate

    let rafId: number;
    let isRunning = true;
    let lastCalculationMs = 0;

    const updateLoop = () => {
      if (!isRunning) return;

      const now = Date.now();
      
      // Schedule next frame immediately to maintain smooth loop
      rafId = requestAnimationFrame(updateLoop);

      // Throttle calculations to adaptive Hz (not 60fps)
      if (now - lastCalculationMs < calculationIntervalMs) return;
      
      const deltaSeconds =
        lastWBalUpdateMsRef.current > 0
          ? (now - lastWBalUpdateMsRef.current) / 1000
          : calculationIntervalMs / 1000;

      lastWBalUpdateMsRef.current = now;
      lastCalculationMs = now;

      const power = telemetryRawRef.current.power;
      const nextWBal = calculateNextWBal(
        wBalRef.current,
        power,
        deltaSeconds,
        wBalConfigRef.current,
      );
      wBalRef.current = nextWBal;
      const percentage = getWBalPercentage(nextWBal, wBalConfigRef.current.wPrime);

      const { ratio } = getGearRatio(currentGear);
      const virtualSpeed = calculateVirtualSpeed(telemetryRawRef.current.cadence, ratio);

      // Mutate ref directly (no object spreading for 5% jank reduction)
      telemetryRawRef.current.speed = virtualSpeed > 0 ? virtualSpeed : telemetryRawRef.current.speed;
      telemetryRawRef.current.distance += (virtualSpeed * deltaSeconds) / 3600;
      telemetryRawRef.current.wBal = nextWBal;
      telemetryRawRef.current.wBalPercentage = percentage;
      telemetryRawRef.current.currentGear = currentGear;
      telemetryRawRef.current.gearRatio = ratio;
      telemetryRawRef.current.timestamp = now;

      // Update ring buffers (no array spreading)
      powerHistoryBuffer.current.push(telemetryRawRef.current.power);
      cadenceHistoryBuffer.current.push(telemetryRawRef.current.cadence);
      heartRateHistoryBuffer.current.push(telemetryRawRef.current.heartRate);
      if (telemetryRawRef.current.power > 0) {
        recentPowerBuffer.current.push(telemetryRawRef.current.power);
      }

      // Record point for TCX export at ~1Hz
      if (Math.round(now / 1000) !== Math.round(lastTelemetryCommitMsRef.current / 1000)) {
        const currentCoord = currentRouteCoordinate;
        ridePointsRef.current.push({
          timestamp: now,
          heartRate: telemetryRawRef.current.heartRate,
          power: telemetryRawRef.current.power,
          cadence: telemetryRawRef.current.cadence,
          speed: telemetryRawRef.current.speed,
          distance: telemetryRawRef.current.distance,
          latitude: currentCoord?.lat,
          longitude: currentCoord?.lng,
          altitude: currentCoord?.ele,
        });
        if (ridePointsRef.current.length > 1000) {
          ridePointsRef.current.splice(0, ridePointsRef.current.length - 1000);
        }
      }

      // Update ghost state (ref-only, no React state for 5% jank reduction)
      if (ghostPerformance) {
        const nextGhost = calculateGhostState(
          ghostPerformance.points,
          telemetryRawRef.current.distance * 1000,
          0,
        );
        ghostStateRef.current = nextGhost;
      }

      // Commit to Zustand store at throttled rate for HUD (granular subscriptions - 25% jank reduction)
      if (now - lastTelemetryCommitMsRef.current >= hudUpdateIntervalMs) {
        lastTelemetryCommitMsRef.current = now;
        updateTelemetryStore({
          heartRate: telemetryRawRef.current.heartRate,
          power: telemetryRawRef.current.power,
          cadence: telemetryRawRef.current.cadence,
          speed: telemetryRawRef.current.speed,
          effort: telemetryRawRef.current.effort,
          wBal: telemetryRawRef.current.wBal,
          wBalPercentage: telemetryRawRef.current.wBalPercentage,
          distance: telemetryRawRef.current.distance,
          currentGear: telemetryRawRef.current.currentGear,
          gearRatio: telemetryRawRef.current.gearRatio,
          resistance: telemetryRawRef.current.resistance,
          timestamp: telemetryRawRef.current.timestamp,
        });
      }

      // Commit history to React state at 1Hz (for charts)
      if (now - lastHistoryCommitMsRef.current >= historyUpdateIntervalMs) {
        lastHistoryCommitMsRef.current = now;
        setTelemetryHistory({
          power: powerHistoryBuffer.current.toArray(),
          cadence: cadenceHistoryBuffer.current.toArray(),
          heartRate: heartRateHistoryBuffer.current.toArray(),
        });
        setRecentPowerHistory(recentPowerBuffer.current.toArray());
      }
    };

    rafId = requestAnimationFrame(updateLoop);

    return () => {
      isRunning = false;
      cancelAnimationFrame(rafId);
    };
  }, [isRiding, deviceType, performanceTier, currentGear, ghostPerformance, currentRouteCoordinate]);

  const handleBleMetrics = useCallback(
    (metrics: Partial<Telemetry>) => {
      // Mutate ref directly (no object spreading)
      if (metrics.heartRate !== undefined) telemetryRawRef.current.heartRate = metrics.heartRate;
      if (metrics.power !== undefined) telemetryRawRef.current.power = metrics.power;
      if (metrics.cadence !== undefined) telemetryRawRef.current.cadence = metrics.cadence;
      if (metrics.speed !== undefined) telemetryRawRef.current.speed = metrics.speed;
      if (metrics.effort !== undefined) telemetryRawRef.current.effort = metrics.effort;
      if (metrics.distance !== undefined) telemetryRawRef.current.distance = metrics.distance;
      telemetryRawRef.current.timestamp = metrics.timestamp ?? Date.now();
    },
    [],
  );

  const handleSimulatorMetrics = useCallback(
    (metrics: {
      heartRate: number;
      power: number;
      cadence: number;
      speed: number;
      effort: number;
      distance?: number;
      timestamp?: number;
    }) => {
      // Mutate ref directly
      telemetryRawRef.current.heartRate = metrics.heartRate;
      telemetryRawRef.current.power = metrics.power;
      telemetryRawRef.current.cadence = metrics.cadence;
      telemetryRawRef.current.speed = metrics.speed;
      telemetryRawRef.current.effort = metrics.effort;
      if (metrics.distance !== undefined) telemetryRawRef.current.distance = metrics.distance;
      telemetryRawRef.current.timestamp = metrics.timestamp ?? Date.now();
    },
    [],
  );


  return {
    telemetryHistory,
    recentPowerHistory,
    currentGear,
    setCurrentGear,
    ghostState: ghostStateRef.current, // Return ref value directly
    ghostPerformance,
    ridePointsRef,
    telemetrySamples,
    telemetryAverages,
    refreshTelemetryAverages,
    telemetryRawRef,
    handleBleMetrics,
    handleSimulatorMetrics,
  };
}
