"use client";

import { useEffect, useRef } from "react";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { useCoachingStore } from "@/app/stores/coaching-store";
import { getRideHistory, getPRs } from "@/app/lib/analytics/ride-history";

/**
 * usePrPursuit — Watches live power output and fires coach messages
 * when the rider exceeds their all-time best power PR.
 *
 * Fires at most once per ride to avoid spam.
 */
export function usePrPursuit(isRiding: boolean) {
  const prBeatenRef = useRef(false);
  const prAnnouncedRef = useRef(false);

  useEffect(() => {
    if (!isRiding) {
      prBeatenRef.current = false;
      prAnnouncedRef.current = false;
      return;
    }

    const prs = getPRs(getRideHistory());
    const bestPower = prs.bestPower;
    if (!bestPower || bestPower < 50) return; // No meaningful PR yet

    const unsub = useTelemetryStore.subscribe((state) => {
      const currentPower = state.snapshot.power ?? 0;
      if (currentPower > bestPower && !prBeatenRef.current) {
        prBeatenRef.current = true;
        if (!prAnnouncedRef.current) {
          prAnnouncedRef.current = true;
          const overBy = Math.round(currentPower - bestPower);
          useCoachingStore.getState().setLastCoachMessage(
            `New PR! ${currentPower}W — ${overBy}W above your best!`
          );
        }
      }
    });

    return () => unsub();
  }, [isRiding]);
}
