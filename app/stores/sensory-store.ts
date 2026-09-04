/**
 * Sensory Events Store — stores the latest sensory cue for visual components
 * to react to. Written by useSensorySync, read by HUD/visual components.
 *
 * Design: minimal event queue, each event has a type, timestamp, and optional
 * payload. Components read the latest event and animate accordingly.
 */

import { create } from "zustand";
import type { IntervalPhase } from "@/app/lib/phase-theme";

export type SensoryEventType =
  | "phase-change"
  | "sprint-start"
  | "sprint-end"
  | "pr-beat"
  | "recovery-start"
  | "ride-start"
  | "countdown-tick"
  | "countdown-go"
  | null;

export interface SensoryEvent {
  type: SensoryEventType;
  timestamp: number;
  phase?: IntervalPhase;
  effort?: number;
  /** Which interval index changed (for phase-change) */
  fromPhase?: IntervalPhase;
  toPhase?: IntervalPhase;
}

interface SensoryState {
  latestEvent: SensoryEvent | null;
  countdownPhase: "none" | "three" | "two" | "one" | "go";
  countdownStartTime: number;
  /** Monotonic per-pedal-stroke counter. High-frequency impulses (≤11Hz)
   *  deliberately bypass latestEvent: that slot has React subscribers and
   *  carries low-frequency cues (phase-change, pr-beat) that strokes must
   *  not clobber. Consumers read this via getState() in useFrame. */
  strokeSeq: number;
}

interface SensoryActions {
  setLatestEvent: (event: SensoryEvent) => void;
  setCountdownPhase: (phase: SensoryState["countdownPhase"]) => void;
  resetCountdown: () => void;
  bumpStrokeSeq: () => void;
}

export const useSensoryStore = create<SensoryState & SensoryActions>()((set) => ({
  latestEvent: null,
  countdownPhase: "none",
  countdownStartTime: 0,
  strokeSeq: 0,

  setLatestEvent: (event) => set({ latestEvent: event }),
  bumpStrokeSeq: () => set((s) => ({ strokeSeq: s.strokeSeq + 1 })),
  setCountdownPhase: (phase) => set({
    countdownPhase: phase,
    countdownStartTime: phase !== "none" ? Date.now() : 0,
  }),
  resetCountdown: () => set({ countdownPhase: "none", countdownStartTime: 0 }),
}));

/** Hook: fire a sensory event and return it for visual consumption */
export function useSensorySync() {
  const { setLatestEvent, setCountdownPhase, resetCountdown } = useSensoryStore();
  const isRiding = useRideStore((s) => s.isActive);
  const phase = useCoachingStore((s) => s.currentInterval?.phase ?? null) as IntervalPhase | null;
  const effort = useTelemetryStore((s) => s.snapshot.effort);
  const prBeaten = useCoachingStore((s) => s.prBeaten);

  const lastPhaseRef = useRef<IntervalPhase | null>(null);
  const hadPrRef = useRef(false);
  const rideStartedRef = useRef(false);

  useEffect(() => {
    if (!isRiding) return;

    // Detect phase change
    if (phase !== lastPhaseRef.current) {
      const event: SensoryEvent = {
        type: "phase-change",
        timestamp: Date.now(),
        fromPhase: lastPhaseRef.current ?? undefined,
        toPhase: phase ?? undefined,
        phase,
        effort,
      };

      // Sub-type detection for stronger visual cues
      if (phase === "sprint" && lastPhaseRef.current !== "sprint") {
        event.type = "sprint-start";
      } else if (lastPhaseRef.current === "sprint" && phase !== "sprint") {
        event.type = "sprint-end";
      } else if (phase === "recovery" && lastPhaseRef.current !== "recovery") {
        event.type = "recovery-start";
      }

      setLatestEvent(event);
      lastPhaseRef.current = phase;
    }

    // Detect PR beat (fires once per ride)
    if (prBeaten && !hadPrRef.current) {
      hadPrRef.current = true;
      setLatestEvent({ type: "pr-beat", timestamp: Date.now(), phase, effort });
    }

    // Detect ride start (first active frame)
    if (!rideStartedRef.current && isRiding) {
      rideStartedRef.current = true;
      setLatestEvent({ type: "ride-start", timestamp: Date.now(), phase, effort });
    }
  }, [isRiding, phase, effort, prBeaten, setLatestEvent]);

  return {
    setCountdownPhase,
    resetCountdown,
  };
}

/** Hook: read the latest sensory event for visual reactions */
export function useSensoryEvent() {
  return useSensoryStore((s) => s.latestEvent);
}

/** Hook: read the countdown state for pre-ride sequence.
 *  Uses scalar selectors + useMemo — an inline object selector returns a fresh
 *  identity every call and would re-render the consumer on ANY store change. */
export function useCountdown() {
  const phase = useSensoryStore((s) => s.countdownPhase);
  const startTime = useSensoryStore((s) => s.countdownStartTime);
  return useMemo(() => ({ phase, startTime }), [phase, startTime]);
}

// Need zustand
import { useEffect, useMemo, useRef } from "react";
import { useRideStore } from "@/app/stores/ride-store";
import { useCoachingStore } from "@/app/stores/coaching-store";
import { useTelemetryStore } from "@/app/stores/telemetry-store";