"use client";

/***/
import { useEffect, useRef, useCallback } from "react";
import type { useRideCoordinator } from "@/app/engines/use-ride-coordinator";

interface UseDemoEffortParams {
  isRiding: boolean;
  isPracticeMode: boolean;
  coordinator: ReturnType<typeof useRideCoordinator>;
}

/**
 * useDemoEffort — Keyboard-driven effort generation for demo/practice mode.
 *
 * Maps keyboard input to cadence/power/effort:
 * - W / ArrowUp  → pedal harder  (effort 0→1000)
 * - S / ArrowDown → brake         (effort drops)
 * - idle         → coast slowly  (effort settles to ~200)
 *
 * Feeds generated metrics into the coordinator pipeline so the reactive
 * 3D world responds to keyboard input — not just gear shifts.
 *
 * Works ONLY for practice/demo mode (isPracticeMode=true).
 */
export function useDemoEffort({
  isRiding,
  isPracticeMode,
  coordinator,
}: UseDemoEffortParams) {
  const effortRef = useRef(200); // 0–1000
  const keysRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const coordinatorRef = useRef(coordinator);
  coordinatorRef.current = coordinator;

  // ─── Key tracking ──────────────────────────────────────────────
  useEffect(() => {
    if (!isPracticeMode || typeof window === "undefined") return;

    const onDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      keysRef.current.add(e.key);
    };
    const onUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [isPracticeMode]);

  // ─── Effort → cadence/power loop ────────────────────────────────
  useEffect(() => {
    if (!isPracticeMode || !isRiding) {
      effortRef.current = 200;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const tick = () => {
      const keys = keysRef.current;
      const up = keys.has("w") || keys.has("W") || keys.has("ArrowUp");
      const down = keys.has("s") || keys.has("S") || keys.has("ArrowDown");

      if (up) {
        effortRef.current = Math.min(1000, effortRef.current + 80);
      } else if (down) {
        effortRef.current = Math.max(0, effortRef.current - 120);
      } else {
        // Coast: settle toward a comfortable base
        effortRef.current += effortRef.current < 200 ? 30 : -20;
        effortRef.current = Math.max(0, Math.min(1000, effortRef.current));
      }

      const effort = effortRef.current; // 0–1000
      const cadence = Math.round(40 + (effort / 1000) * 80); // 40–120 RPM
      const power = Math.round((effort / 1000) * 400);       // 0–400W
      const speed = Math.round((effort / 1000) * 45);        // 0–45 km/h

      coordinatorRef.current?.ingestSimulatorMetrics({
        heartRate: Math.round(100 + (effort / 1000) * 80),  // 100–180 bpm
        power,
        cadence,
        speed,
        effort,
        distance: 0,
        timestamp: Date.now(),
      });
    };

    intervalRef.current = setInterval(tick, 100);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [isPracticeMode, isRiding]);
}
