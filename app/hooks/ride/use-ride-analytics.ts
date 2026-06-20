"use client";

import { useEffect, useRef, useState } from "react";
import { useRideStore } from "@/app/stores/ride-store";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { useHaptic } from "@/app/hooks/use-haptic";
import { ANALYTICS_EVENTS, trackEvent } from "@/app/lib/analytics/events";

interface UseRideAnalyticsParams {
  classId: string;
  isPracticeMode: boolean;
  isRiding: boolean;
  rideProgress: number;
  bleConnected: boolean;
  useSimulator: boolean;
  telemetryEffort: number;
  playSound: (type: unknown) => void;
}

export function useRideAnalytics({
  classId,
  isPracticeMode,
  isRiding,
  rideProgress,
  bleConnected,
  useSimulator,
  telemetryEffort,
  playSound,
}: UseRideAnalyticsParams) {
  const trackedEntryViewRef = useRef(false);
  const trackedCompletionRef = useRef(false);
  const trackedLiveTelemetryRef = useRef(false);
  const trackedMilestoneRef = useRef(false);
  const [showMilestone, setShowMilestone] = useState<{ title: string; subtitle: string } | null>(null);
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
    if (telemetryEffort > 900) {
      trackedMilestoneRef.current = true;
      setShowMilestone({ title: "ELITE EFFORT", subtitle: "You just crossed 900 effort points!" });
      haptic.success();
      playSound("achievement");
      setTimeout(() => setShowMilestone(null), 5000);
    }
  }, [telemetryEffort, isRiding, haptic, playSound]);

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
    showMilestone,
    setShowMilestone,
    trackLiveTelemetry,
    resetCompletionTracking,
    trackedCompletionRef,
  };
}
