/**
 * useRideCoordinator — Bridges the RideCoordinator into the React page.
 *
 * This hook manages the lifecycle of the coordinator and provides methods
 * that the page's existing callbacks can use to feed data through the engine
 * architecture. It does NOT replace existing hooks — it's additive.
 *
 * The coordinator writes to the same Zustand stores that the existing hooks
 * read from, so both paths produce the same UI output.
 *
 * Usage (page.tsx):
 *   const coordinator = useRideCoordinator();
 *   // Wire into existing callbacks:
 *   const handleBleMetrics = (metrics) => {
 *     coordinator.ingestBleMetrics(metrics);
 *     // ...existing logic continues...
 *   };
 */

"use client";

import { useRef, useCallback, useEffect } from "react";
import { RideCoordinator } from "./coordinator";
import type { RideStartConfig, TelemetrySnapshot } from "./types";

export function useRideCoordinator() {
  const coordinatorRef = useRef<RideCoordinator | null>(null);

  /**
   * Ensures a coordinator instance exists (lazy init, per-coordinator).
   * Returns the current coordinator or null.
   */
  const getCoordinator = useCallback((): RideCoordinator | null => {
    return coordinatorRef.current;
  }, []);

  /**
   * Starts a ride session: creates the coordinator, configures engines,
   * starts the commit loop, and initializes Zustand state.
   *
   * Call this when the ride start button is pressed.
   */
  const startRide = useCallback(async (config: RideStartConfig): Promise<void> => {
    // Dispose any existing coordinator first (safety)
    if (coordinatorRef.current) {
      coordinatorRef.current.dispose();
    }

    const coordinator = new RideCoordinator();
    coordinatorRef.current = coordinator;

    await coordinator.start(config);
  }, []);

  /**
   * Feeds BLE metrics into the coordinator's telemetry engine.
   * Safe to call before coordinator.start() — will be a no-op.
   */
  const ingestBleMetrics = useCallback((metrics: Partial<TelemetrySnapshot>): void => {
    coordinatorRef.current?.telemetry.ingest(metrics);
  }, []);

  /**
   * Feeds simulator metrics into the coordinator's telemetry engine.
   * Simulator commits immediately for responsive UI.
   */
  const ingestSimulatorMetrics = useCallback((
    metrics: {
      heartRate: number;
      power: number;
      cadence: number;
      speed: number;
      effort: number;
      distance?: number;
      timestamp?: number;
    },
  ): void => {
    coordinatorRef.current?.ingestSimulatorMetrics(metrics);
  }, []);

  /**
   * Pauses the ride session.
   */
  const pauseRide = useCallback((): void => {
    coordinatorRef.current?.pause();
  }, []);

  /**
   * Resumes the ride session.
   */
  const resumeRide = useCallback((): void => {
    coordinatorRef.current?.resume();
  }, []);

  /**
   * Stops and disposes the ride session.
   */
  const stopRide = useCallback(async (): Promise<void> => {
    const coordinator = coordinatorRef.current;
    if (!coordinator) return;

    await coordinator.stop();
    coordinator.dispose();
    coordinatorRef.current = null;
  }, []);

  /**
   * Updates elapsed time (called by lifecycle tick from existing hooks).
   */
  const setElapsedSeconds = useCallback((seconds: number): void => {
    coordinatorRef.current?.telemetry.setElapsedSeconds(seconds);
  }, []);

  /**
   * Sets the current gear number on the telemetry engine.
   */
  const setCurrentGear = useCallback((gear: number): void => {
    coordinatorRef.current?.telemetry.setCurrentGear(gear);
  }, []);

  // Cleanup on unmount — dispose the coordinator to stop RAF loops and EventBus
  useEffect(() => {
    return () => {
      if (coordinatorRef.current) {
        coordinatorRef.current.dispose();
        coordinatorRef.current = null;
      }
    };
  }, []);

  return {
    getCoordinator,
    startRide,
    ingestBleMetrics,
    ingestSimulatorMetrics,
    pauseRide,
    resumeRide,
    stopRide,
    setElapsedSeconds,
    setCurrentGear,
  };
}
