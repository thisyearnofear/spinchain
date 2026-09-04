"use client";

import { useEffect, useRef } from "react";
import { useHaptic } from "@/app/hooks/use-haptic";
import { ANALYTICS_EVENTS, trackEvent } from "@/app/lib/analytics/events";
import { useCoachingStore } from "@/app/stores/coaching-store";
import { useTelemetryStore } from "@/app/stores/telemetry-store";

interface UseRideAnalyticsParams {
  classId: string;
  isPracticeMode: boolean;
  isRiding: boolean;
  rideProgress: number;
  bleConnected: boolean;
  useSimulator: boolean;
  playSound: (type: unknown) => void;
}

export function useRideAnalytics({
  classId,
  isPracticeMode,
  isRiding,
  rideProgress,
  bleConnected,
  useSimulator,
  playSound,
}: UseRideAnalyticsParams) {
  const trackedEntryViewRef = useRef(false);
  const trackedCompletionRef = useRef(false);
  const trackedLiveTelemetryRef = useRef(false);
  const trackedMilestoneRef = useRef(false);
  const haptic = useHaptic();

  useEffect(() => {
    if (isRiding || rideProgress > 0 || trackedEntryViewRef.current) return;
    trackedEntryViewRef.current = true;
    trackEvent(ANALYTICS_EVENTS.RIDE_ENTRY_VIEWED, { classId, practiceMode: isPracticeMode });
  }, [classId, isPracticeMode, isRiding, rideProgress]);

  useEffect(() => {
    if (rideProgress < 100 || trackedCompletionRef.current) return;
    trackedCompletionRef.current = true;
    trackEvent(ANALYTICS_EVENTS.RIDE_COMPLETED, {
      classId,
      source: bleConnected ? "live-bike" : isPracticeMode && useSimulator ? "simulator" : "estimated",
      practiceMode: isPracticeMode,
    });
  }, [bleConnected, classId, isPracticeMode, rideProgress, useSimulator]);

  useEffect(() => {
    if (!isRiding || trackedMilestoneRef.current) return;
    // Poll at 1Hz instead of subscribing to the live effort value (which changes
    // on every telemetry commit) so this hook doesn't re-run/re-render per commit.
    const id = setInterval(() => {
      if (trackedMilestoneRef.current) return;
      const effort = useTelemetryStore.getState().snapshot.effort;
      if (effort > 900) {
        trackedMilestoneRef.current = true;
        // Surface through the coach channel — no screen-blocking milestone modal.
        useCoachingStore.getState().setLastCoachMessage(
          "ELITE EFFORT — You just crossed 900 effort points!",
        );
        haptic.success();
        playSound("achievement");
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isRiding, haptic, playSound]);

  const trackLiveTelemetry = () => {
    if (!trackedLiveTelemetryRef.current) {
      trackedLiveTelemetryRef.current = true;
      trackEvent(ANALYTICS_EVENTS.TELEMETRY_LIVE_READY, { classId, practiceMode: isPracticeMode });
    }
  };

  const resetCompletionTracking = () => {
    trackedCompletionRef.current = false;
  };

  return {
    trackLiveTelemetry,
    resetCompletionTracking,
    trackedCompletionRef,
  };
}
