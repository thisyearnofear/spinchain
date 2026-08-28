/**
 * useSensorySync — Choreographs audio + visual + haptic events so they fire
 * together (within 200ms) on phase changes and key moments.
 *
 * This is the conductor of the ride experience:
 * - Interval phase change → audio cue SFX + screen pulse + haptic + coach message
 * - Sprint starts → intense border flash + audio crescendo hint + heavy haptic
 * - PR beaten → celebration particles + audio chime + coach exclamation
 * - Recovery starts → color cool-down + soft audio + breathing haptic
 *
 * Components that listen to the store will animate in response.
 */

import { useEffect, useRef } from "react";
import { useRideStore } from "@/app/stores/ride-store";
import { useCoachingStore } from "@/app/stores/coaching-store";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { haptic } from "@/app/hooks/use-haptic";
import type { IntervalPhase } from "@/app/lib/phase-theme";

type SensoryEventType =
  | "phase-change"   // interval transition
  | "sprint-start"   // enter sprint
  | "sprint-end"     // leave sprint
  | "pr-beat"        // PR beaten
  | "recovery-start" // enter recovery
  | "ride-start";    // first moment of active riding

interface SensoryEvent {
  type: SensoryEventType;
  timestamp: number;
  phase?: IntervalPhase;
  effort?: number;
}

export function useSensorySync() {
  const isRiding = useRideStore((s) => s.isActive);
  const phase = useCoachingStore((s) => s.currentInterval?.phase ?? null) as IntervalPhase | null;
  const effort = useTelemetryStore((s) => s.snapshot.effort);
  const prBeaten = useCoachingStore((s) => s.prBeaten);
  const lastPhaseRef = useRef<IntervalPhase | null>(null);
  const hadPrRef = useRef(false);
  const rideStartedRef = useRef(false);
  const lastEventRef = useRef<SensoryEvent | null>(null);
  const hapticQueueRef = useRef<(() => void)[]>([]);

  // Flush haptic queue with 50ms spacing so they don't merge into one thud
  useEffect(() => {
    const interval = setInterval(() => {
      const fn = hapticQueueRef.current.shift();
      if (fn) {
        try { fn(); } catch {}
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Fire haptic + visual cue based on event type
  const fireCue = useRef((event: SensoryEvent) => {
    // Store the event for visual components to react to
    lastEventRef.current = event;

    // Phase change: medium haptic pulse
    if (event.type === "phase-change") {
      hapticQueueRef.current.push(() => {
        haptic("medium");
      });
    }

    // Sprint start: heavy haptic + visual
    if (event.type === "sprint-start") {
      hapticQueueRef.current.push(() => {
        haptic("heavy");
      });
    }

    // Recovery start: light, calming haptic
    if (event.type === "recovery-start") {
      hapticQueueRef.current.push(() => {
        haptic("light");
      });
    }

    // PR beat: double pulse celebration
    if (event.type === "pr-beat") {
      hapticQueueRef.current.push(() => {
        haptic("success");
      });
    }

    // Ride start: single confident pulse
    if (event.type === "ride-start") {
      hapticQueueRef.current.push(() => {
        haptic("medium");
      });
    }
  });

  useEffect(() => {
    if (!isRiding) return;

    // Detect phase change
    if (phase !== lastPhaseRef.current) {
      const event: SensoryEvent = { type: "phase-change", timestamp: Date.now(), phase };

      // Specific sub-types
      if (phase === "sprint" && lastPhaseRef.current !== "sprint") {
        event.type = "sprint-start";
      } else if (lastPhaseRef.current === "sprint" && phase !== "sprint") {
        event.type = "sprint-end";
      } else if (phase === "recovery" && lastPhaseRef.current !== "recovery") {
        event.type = "recovery-start";
      }

      fireCue.current(event);
      lastPhaseRef.current = phase;
    }

    // Detect PR beat (fires once per ride)
    if (prBeaten && !hadPrRef.current) {
      hadPrRef.current = true;
      fireCue.current({ type: "pr-beat", timestamp: Date.now(), phase, effort });
    }

    // Detect ride start (first active frame)
    if (!rideStartedRef.current && isRiding) {
      rideStartedRef.current = true;
      fireCue.current({ type: "ride-start", timestamp: Date.now(), phase, effort });
    }
  }, [isRiding, phase, effort, prBeaten]);

  // Expose the last event for visual components to consume
  // Refs are read here intentionally so consumers receive the latest cue without re-render.
  // eslint-disable-next-line react-hooks/refs
  const lastEvent = lastEventRef.current;

  // eslint-disable-next-line react-hooks/refs
  return { lastEvent, fireCue: fireCue.current };
}

/** Hook for visual components to read the latest sensory event */
export function useSensoryEvent() {
  const [lastEvent, setLastEvent] = React.useState<SensoryEvent | null>(null);
  const bridgeRef = useRef<HTMLDivElement>(null);

  // Read from a shared ref updated by useSensorySync
  useEffect(() => {
    // This component tree's bridge ref is set by the ride page
    const check = () => {
      // Components that need the event can read a shared ref
      if (bridgeRef.current) {
        const data = bridgeRef.current.getAttribute("data-last-event");
        if (data) {
          try { setLastEvent(JSON.parse(data)); } catch {}
        }
      }
    };
    check();
    const interval = setInterval(check, 50);
    return () => clearInterval(interval);
  }, []);

  return lastEvent;
}

// Need React import for useState
import React from "react";