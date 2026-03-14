"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  calculateNextWBal,
  DEFAULT_WBAL_CONFIG,
  getWBalPercentage,
  getGearRatio,
  calculateVirtualSpeed,
  DEFAULT_ROAD_GEARS,
  type WBalConfig,
} from "../../lib/analytics/physiological-models";
import {
  calculateGhostState,
  generateMockGhost,
  type GhostPerformance,
  type GhostState,
} from "../../lib/analytics/ghost-service";
import type { RideRecordPoint } from "../../lib/analytics/ride-recorder";

export interface TelemetryState {
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
  timestamp: number;
}

const INITIAL_TELEMETRY: TelemetryState = {
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
  timestamp: Date.now(),
};

interface UseRideTelemetryOptions {
  isRiding: boolean;
  deviceType: "mobile" | "tablet" | "desktop";
  routeCoordinates: { lat: number; lng: number; ele?: number }[];
  currentRouteCoordinate: { lat: number; lng: number; ele?: number } | null;
  elapsedTime: number;
  playSound?: (sound: string) => void;
}

export function useRideTelemetry({
  isRiding,
  deviceType,
  routeCoordinates,
  currentRouteCoordinate,
  elapsedTime,
  playSound,
}: UseRideTelemetryOptions) {
  const [telemetry, setTelemetry] = useState<TelemetryState>(INITIAL_TELEMETRY);
  const [recentPowerHistory, setRecentPowerHistory] = useState<number[]>([]);
  const [currentGear, setCurrentGear] = useState(10);

  const telemetryRawRef = useRef<TelemetryState>({ ...INITIAL_TELEMETRY });
  const wBalRef = useRef<number>(DEFAULT_WBAL_CONFIG.wPrime);
  const wBalConfigRef = useRef<WBalConfig>(DEFAULT_WBAL_CONFIG);
  const lastWBalUpdateMsRef = useRef<number>(0);
  const lastTelemetryCommitMsRef = useRef(0);

  // Ghost Rider
  const [ghostPerformance, setGhostPerformance] = useState<GhostPerformance | null>(null);
  const [ghostState, setGhostState] = useState<GhostState>({
    leadLagTime: 0,
    distanceGap: 0,
    ghostPoint: null,
  });

  // Ride recording
  const telemetrySamples = useRef<{ hr: number; power: number; effort: number }[]>([]);
  const ridePointsRef = useRef<RideRecordPoint[]>([]);

  // Initialize ghost from route
  useEffect(() => {
    if (routeCoordinates.length > 0 && !ghostPerformance) {
      const mock = generateMockGhost(routeCoordinates, 25);
      setGhostPerformance(mock);
    }
  }, [routeCoordinates, ghostPerformance]);

  // Keyboard gear shifting
  useEffect(() => {
    if (typeof window === "undefined" || !isRiding) return;
    const totalGears = DEFAULT_ROAD_GEARS.front.length * DEFAULT_ROAD_GEARS.rear.length;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        setCurrentGear(prev => Math.min(totalGears, prev + 1));
        playSound?.("resistanceUp");
      } else if (e.key === "ArrowDown") {
        setCurrentGear(prev => Math.max(1, prev - 1));
        playSound?.("resistanceDown");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRiding, playSound]);

  // Commit buffered telemetry at fixed UI rate
  useEffect(() => {
    if (!isRiding) return;

    const uiHz = deviceType === "mobile" ? 2 : 4;
    const intervalMs = Math.floor(1000 / uiHz);

    const id = setInterval(() => {
      const now = Date.now();
      if (now - lastTelemetryCommitMsRef.current < intervalMs) return;

      const deltaSeconds = lastWBalUpdateMsRef.current > 0
        ? (now - lastWBalUpdateMsRef.current) / 1000
        : intervalMs / 1000;

      lastWBalUpdateMsRef.current = now;
      lastTelemetryCommitMsRef.current = now;

      // W'bal physiological model
      const power = telemetryRawRef.current.power;
      const nextWBal = calculateNextWBal(wBalRef.current, power, deltaSeconds, wBalConfigRef.current);
      wBalRef.current = nextWBal;
      const percentage = getWBalPercentage(nextWBal, wBalConfigRef.current.wPrime);

      // Virtual speed from gear
      const { ratio } = getGearRatio(currentGear);
      const virtualSpeed = calculateVirtualSpeed(telemetryRawRef.current.cadence, ratio);

      telemetryRawRef.current = {
        ...telemetryRawRef.current,
        speed: virtualSpeed > 0 ? virtualSpeed : telemetryRawRef.current.speed,
        distance: telemetryRawRef.current.distance + ((virtualSpeed * deltaSeconds) / 3600),
        wBal: nextWBal,
        wBalPercentage: percentage,
        currentGear,
        gearRatio: ratio,
        timestamp: now,
      };

      // Record point for TCX export (~1Hz)
      if (Math.round(now / 1000) !== Math.round(lastTelemetryCommitMsRef.current / 1000)) {
        const coord = currentRouteCoordinate;
        ridePointsRef.current.push({
          timestamp: now,
          heartRate: telemetryRawRef.current.heartRate,
          power: telemetryRawRef.current.power,
          cadence: telemetryRawRef.current.cadence,
          speed: telemetryRawRef.current.speed,
          distance: telemetryRawRef.current.distance,
          latitude: coord?.lat,
          longitude: coord?.lng,
          altitude: coord?.ele,
        });
      }

      // Ghost rider
      if (ghostPerformance) {
        const nextGhost = calculateGhostState(
          ghostPerformance.points,
          telemetryRawRef.current.distance * 1000,
          elapsedTime,
        );
        setGhostState(nextGhost);
      }

      setTelemetry(telemetryRawRef.current);
    }, intervalMs);

    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRiding, deviceType]);

  // Track power history
  useEffect(() => {
    if (telemetry.power <= 0) return;
    setRecentPowerHistory(prev => [...prev.slice(-19), telemetry.power]);
  }, [telemetry.power]);

  // Buffer BLE metrics (no React rerender)
  const handleBleMetrics = useCallback((metrics: {
    heartRate?: number;
    power?: number;
    cadence?: number;
    speed?: number;
    effort?: number;
    distance?: number;
    timestamp?: number;
  }) => {
    telemetryRawRef.current = {
      ...telemetryRawRef.current,
      heartRate: metrics.heartRate ?? telemetryRawRef.current.heartRate,
      power: metrics.power ?? telemetryRawRef.current.power,
      cadence: metrics.cadence ?? telemetryRawRef.current.cadence,
      speed: metrics.speed ?? telemetryRawRef.current.speed,
      effort: metrics.effort ?? telemetryRawRef.current.effort,
      distance: metrics.distance ?? telemetryRawRef.current.distance,
      timestamp: metrics.timestamp ?? Date.now(),
    };
  }, []);

  // Buffer simulator metrics (immediate UI update for responsiveness)
  const handleSimulatorMetrics = useCallback((metrics: {
    heartRate: number;
    power: number;
    cadence: number;
    speed: number;
    effort: number;
    distance?: number;
    timestamp?: number;
  }) => {
    telemetryRawRef.current = {
      ...telemetryRawRef.current,
      ...metrics,
      distance: metrics.distance ?? telemetryRawRef.current.distance,
      timestamp: metrics.timestamp ?? Date.now(),
    };
    setTelemetry(telemetryRawRef.current);
  }, []);

  // Collect telemetry samples for averages
  const recordSample = useCallback(() => {
    const raw = telemetryRawRef.current;
    if (raw.heartRate > 0 || raw.power > 0) {
      telemetrySamples.current.push({
        hr: raw.heartRate,
        power: raw.power,
        effort: raw.effort,
      });
    }
  }, []);

  // Compute averages (only recalculated when ride completes)
  const telemetryAverages = useMemo(() => {
    const samples = telemetrySamples.current;
    if (samples.length === 0) return { avgHr: 0, avgPower: 0, avgEffort: 0 };
    const sum = samples.reduce(
      (acc, s) => ({ hr: acc.hr + s.hr, power: acc.power + s.power, effort: acc.effort + s.effort }),
      { hr: 0, power: 0, effort: 0 },
    );
    return {
      avgHr: Math.round(sum.hr / samples.length),
      avgPower: Math.round(sum.power / samples.length),
      avgEffort: Math.round(sum.effort / samples.length),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telemetry.effort]); // Recompute as effort changes; cheap operation

  const reset = useCallback(() => {
    setRecentPowerHistory([]);
    telemetrySamples.current = [];
    ridePointsRef.current = [];
  }, []);

  return {
    telemetry,
    recentPowerHistory,
    currentGear,
    ghostState,
    telemetryAverages,
    telemetrySamples,
    ridePointsRef,
    handleBleMetrics,
    handleSimulatorMetrics,
    recordSample,
    reset,
    telemetryRawRef,
  };
}
