"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
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
  fetchGhostWithFallback,
  type GhostPerformance,
  type GhostState,
} from "../../lib/analytics/ghost-service";
import type { RideRecordPoint } from "../../lib/analytics/ride-recorder";

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
  bleConnected,
  useSimulator,
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
  const [telemetry, setTelemetry] = useState<Telemetry>(INITIAL_TELEMETRY);
  const [telemetryHistory, setTelemetryHistory] = useState<{
    power: number[];
    cadence: number[];
    heartRate: number[];
  }>({ power: [], cadence: [], heartRate: [] });
  const [recentPowerHistory, setRecentPowerHistory] = useState<number[]>([]);
  const [currentGear, setCurrentGear] = useState(10);

  const telemetryRawRef = useRef<Telemetry>({ ...INITIAL_TELEMETRY });
  const wBalRef = useRef<number>(DEFAULT_WBAL_CONFIG.wPrime);
  const wBalConfigRef = useRef<WBalConfig>(DEFAULT_WBAL_CONFIG);
  const lastWBalUpdateMsRef = useRef<number>(0);
  const lastTelemetryCommitMsRef = useRef(0);

  const [ghostPerformance, setGhostPerformance] =
    useState<GhostPerformance | null>(null);
  const [ghostState, setGhostState] = useState<GhostState>({
    leadLagTime: 0,
    distanceGap: 0,
    ghostPoint: null,
  });

  const ridePointsRef = useRef<RideRecordPoint[]>([]);
  const telemetrySamples = useRef<{ hr: number; power: number; effort: number }[]>([]);

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

  // Commit buffered telemetry at adaptive rate
  useEffect(() => {
    if (!isRiding) return;

    let uiHz: number;
    if (deviceType === "mobile") {
      uiHz = performanceTier === "low" ? 1 : performanceTier === "medium" ? 1.5 : 2;
    } else {
      uiHz = performanceTier === "low" ? 2 : performanceTier === "medium" ? 3 : 4;
    }
    const intervalMs = Math.floor(1000 / uiHz);

    const id = setInterval(() => {
      const now = Date.now();
      if (now - lastTelemetryCommitMsRef.current < intervalMs) return;

      const deltaSeconds =
        lastWBalUpdateMsRef.current > 0
          ? (now - lastWBalUpdateMsRef.current) / 1000
          : intervalMs / 1000;

      lastWBalUpdateMsRef.current = now;
      lastTelemetryCommitMsRef.current = now;

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

      telemetryRawRef.current = {
        ...telemetryRawRef.current,
        speed: virtualSpeed > 0 ? virtualSpeed : telemetryRawRef.current.speed,
        distance: telemetryRawRef.current.distance + (virtualSpeed * deltaSeconds) / 3600,
        wBal: nextWBal,
        wBalPercentage: percentage,
        currentGear,
        gearRatio: ratio,
        timestamp: now,
      };

      ridePointsRef.current.push({
        timestamp: now,
        heartRate: telemetryRawRef.current.heartRate,
        power: telemetryRawRef.current.power,
        cadence: telemetryRawRef.current.cadence,
        speed: telemetryRawRef.current.speed,
        distance: telemetryRawRef.current.distance,
        latitude: currentRouteCoordinate?.lat,
        longitude: currentRouteCoordinate?.lng,
        altitude: currentRouteCoordinate?.ele,
      });

      if (ghostPerformance) {
        const nextGhost = calculateGhostState(
          ghostPerformance.points,
          telemetryRawRef.current.distance * 1000,
          0,
        );
        setGhostState(nextGhost);
      }

      setTelemetry(telemetryRawRef.current);
      setTelemetryHistory((prev) => ({
        power: [...prev.power, telemetryRawRef.current.power].slice(-30),
        cadence: [...prev.cadence, telemetryRawRef.current.cadence].slice(-30),
        heartRate: [...prev.heartRate, telemetryRawRef.current.heartRate].slice(-30),
      }));
    }, intervalMs);

    return () => clearInterval(id);
  }, [isRiding, deviceType, performanceTier, currentGear, ghostPerformance, currentRouteCoordinate]);

  useEffect(() => {
    if (telemetry.power <= 0) return;
    setRecentPowerHistory((prev) => [...prev.slice(-19), telemetry.power]);
  }, [telemetry.power]);

  const handleBleMetrics = useCallback(
    (metrics: Partial<Telemetry>) => {
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
      telemetryRawRef.current = {
        ...telemetryRawRef.current,
        ...metrics,
        distance: metrics.distance ?? telemetryRawRef.current.distance,
        timestamp: metrics.timestamp ?? Date.now(),
      };
      setTelemetry(telemetryRawRef.current);
    },
    [],
  );

  const telemetryAverages = useMemo(() => {
    const samples = telemetrySamples.current;
    if (samples.length === 0) return { avgHr: 0, avgPower: 0, avgEffort: 0 };
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
  }, []);

  return {
    telemetry,
    telemetryHistory,
    recentPowerHistory,
    currentGear,
    setCurrentGear,
    ghostState,
    ghostPerformance,
    ridePointsRef,
    telemetrySamples,
    telemetryAverages,
    telemetryRawRef,
    handleBleMetrics,
    handleSimulatorMetrics,
  };
}