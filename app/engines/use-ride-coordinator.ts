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
import type { WorkoutSoundType } from "@/app/lib/elevenlabs";
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

  // ─── Audio Methods ─────────────────────────────────────────────

  /** Speak a coach voice message */
  const speak = useCallback(
    async (
      text: string,
      emotion?: "calm" | "focused" | "intense" | "celebratory",
    ): Promise<void> => {
      await coordinatorRef.current?.audio.speak(text, emotion);
    },
    [],
  );

  /** Play a workout sound effect */
  const playSound = useCallback(
    async (type: WorkoutSoundType): Promise<void> => {
      await coordinatorRef.current?.audio.playSound(type);
    },
    [],
  );

  /** Play a countdown sequence */
  const playCountdown = useCallback(
    (seconds: number): void => {
      coordinatorRef.current?.audio.playCountdown(seconds);
    },
    [],
  );

  /** Stop all audio (voice + SFX + music) */
  const stopAudio = useCallback((): void => {
    coordinatorRef.current?.audio.stopAll();
  }, []);

  /** Set music playback rate for biometric sync */
  const setMusicSpeed = useCallback(
    (rate: number): void => {
      coordinatorRef.current?.audio.setMusicSpeed(rate);
    },
    [],
  );

  /** Preload sound effects for low-latency playback */
  const preloadSounds = useCallback(
    async (types: WorkoutSoundType[]): Promise<void> => {
      await coordinatorRef.current?.audio.preloadSounds(types);
    },
    [],
  );

  // ─── Sui Methods ───────────────────────────────────────────────

  /** Start a new Sui session */
  const startSuiSession = useCallback(
    async (classId: string, duration: number): Promise<string | null> => {
      return coordinatorRef.current?.sui.startSession(classId, duration) ?? null;
    },
    [],
  );

  /** Join an existing Sui session */
  const joinSuiSession = useCallback(
    async (sessionId: string): Promise<string | null> => {
      return coordinatorRef.current?.sui.joinSession(sessionId) ?? null;
    },
    [],
  );

  /** Close the active Sui session */
  const closeSuiSession = useCallback(
    async (): Promise<boolean> => {
      return coordinatorRef.current?.sui.closeSession() ?? false;
    },
    [],
  );

  /** Submit a single telemetry update to Sui */
  const submitSuiTelemetry = useCallback(
    async (hr: number, power: number, cadence: number): Promise<boolean> => {
      return coordinatorRef.current?.sui.submitTelemetry(hr, power, cadence) ?? false;
    },
    [],
  );

  /** Flush buffered telemetry to Sui */
  const flushSuiTelemetry = useCallback(
    async (): Promise<boolean> => {
      return coordinatorRef.current?.sui.flushTelemetry() ?? false;
    },
    [],
  );

  /** Update the Sui engine config (e.g. when wallet connects) */
  const updateSuiConfig = useCallback(
    (config: Partial<import("./sui-engine").SuiEngineConfig>): void => {
      coordinatorRef.current?.sui.updateConfig(config);
    },
    [],
  );

  /** Get the current Sui session state */
  const getSuiSessionState = useCallback((): import("./sui-engine").SuiSessionState | null => {
    const ref = coordinatorRef.current;
    if (ref === null || ref === undefined) return null;
    return { ...ref.sui.sessionState } as import("./sui-engine").SuiSessionState;
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
    speak,
    playSound,
    playCountdown,
    stopAudio,
    setMusicSpeed,
    preloadSounds,
    startSuiSession,
    joinSuiSession,
    closeSuiSession,
    submitSuiTelemetry,
    flushSuiTelemetry,
    updateSuiConfig,
    getSuiSessionState,
  };
}
