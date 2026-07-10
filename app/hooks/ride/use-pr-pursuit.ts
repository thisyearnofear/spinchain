"use client";

import { useEffect, useRef } from "react";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { useCoachingStore } from "@/app/stores/coaching-store";
import { getRideHistory, getPRs } from "@/app/lib/analytics/ride-history";

/** Minimum telemetry commits before trusting the live running average —
 *  guards against an early power spike reading as a beaten PR. */
const MIN_SAMPLES = 20;

/**
 * usePrPursuit — Watches live power output and fires a coach message +
 * coaching-store.prBeaten when the rider's live average power for this ride
 * exceeds their all-time best AVERAGE power (bestPower is an average across
 * a whole ride, so it must be compared against a running average here, not
 * an instantaneous reading — an instantaneous spike is not a PR).
 *
 * prBeaten is the single source of truth other UI (e.g. the Rive rider's
 * prPulse) should watch instead of reimplementing this comparison.
 *
 * Fires at most once per ride to avoid spam.
 */
export function usePrPursuit(isRiding: boolean) {
  const prAnnouncedRef = useRef(false);
  const powerSumRef = useRef(0);
  const powerSampleCountRef = useRef(0);

  useEffect(() => {
    if (!isRiding) {
      prAnnouncedRef.current = false;
      powerSumRef.current = 0;
      powerSampleCountRef.current = 0;
      useCoachingStore.getState().setPrBeaten(false);
      return;
    }

    const prs = getPRs(getRideHistory());
    const bestPower = prs.bestPower;
    if (!bestPower || bestPower < 50) return; // No meaningful PR yet

    const unsub = useTelemetryStore.subscribe((state) => {
      if (prAnnouncedRef.current) return;
      const currentPower = state.snapshot.power ?? 0;
      if (currentPower <= 0) return; // no signal — don't drag the average down

      powerSumRef.current += currentPower;
      powerSampleCountRef.current += 1;
      if (powerSampleCountRef.current < MIN_SAMPLES) return;

      const runningAvgPower = powerSumRef.current / powerSampleCountRef.current;
      if (runningAvgPower > bestPower) {
        prAnnouncedRef.current = true;
        useCoachingStore.getState().setPrBeaten(true);
        const overBy = Math.round(runningAvgPower - bestPower);
        useCoachingStore.getState().setLastCoachMessage(
          `New PR! ${Math.round(runningAvgPower)}W average — ${overBy}W above your best!`
        );
      }
    });

    return () => unsub();
  }, [isRiding]);
}
