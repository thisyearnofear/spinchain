"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { useRideModalStore } from "@/app/stores/ride-modal-store";
import { milestonesAndStreaks, type SessionMilestone } from "@/app/lib/milestones";
import { experienceManager } from "@/app/lib/experience-level";
import { STORAGE_KEYS } from "@/app/lib/analytics/ride-history";
import type { useFlowState } from "@/app/lib/flow-state";

interface TelemetryAverages {
  avgPower?: number;
  avgHr?: number;
  avgEffort?: number;
}

/**
 * useRideMilestones
 *
 * Owns peak telemetry tracking, ride-completion milestone recording, and
 * real-time milestone popups. Keeps refs off React state so the page doesn't
 * re-render every second for max-value updates.
 */
export function useRideMilestones({
  isRiding,
  elapsedTime,
  showCompletionScreen,
  telemetryAverages,
  flow,
}: {
  isRiding: boolean;
  elapsedTime: number;
  showCompletionScreen: boolean;
  telemetryAverages: TelemetryAverages;
  flow: ReturnType<typeof useFlowState>;
}) {
  const maxPowerRef = useRef(0);
  const maxHRRef = useRef(0);
  const peakEffortRef = useRef(0);
  const [rideMilestones, setRideMilestones] = useState<SessionMilestone[]>([]);

  const shownMilestoneIdsRef = useRef<Set<string>>(new Set());
  const prevRideMinuteRef = useRef(0);
  const setShowMilestone = useRideModalStore((s) => s.setShowMilestone);

  const reset = useCallback(() => {
    maxPowerRef.current = 0;
    maxHRRef.current = 0;
    peakEffortRef.current = 0;
    shownMilestoneIdsRef.current = new Set();
    prevRideMinuteRef.current = 0;
    setRideMilestones([]);
  }, []);

  // Track max telemetry at 1Hz without subscribing the page to the live snapshot.
  useEffect(() => {
    if (!isRiding) return;
    const id = setInterval(() => {
      const s = useTelemetryStore.getState().snapshot;
      if (s.power > maxPowerRef.current) maxPowerRef.current = s.power;
      if (s.heartRate > maxHRRef.current) maxHRRef.current = s.heartRate;
      if (s.effort > peakEffortRef.current) peakEffortRef.current = s.effort;
    }, 1000);
    return () => clearInterval(id);
  }, [isRiding]);

  const recordMilestonesOnCompletion = useCallback(() => {
    milestonesAndStreaks.recordRide({
      durationSec: elapsedTime,
      avgPower: telemetryAverages.avgPower || 0,
      maxPower: maxPowerRef.current,
      avgHR: telemetryAverages.avgHr || 0,
      maxHR: maxHRRef.current,
      avgCadence: 0,
      distance: 0,
      calories: Math.round(elapsedTime * 0.15),
      flowMinutes: flow.totalFlowMinutes,
      peakFlowTier: flow.flowTier,
    });

    const newMilestones = milestonesAndStreaks.detectAndRecordMilestones({
      duration: elapsedTime / 60,
      avgPower: telemetryAverages.avgPower || 0,
      maxPower: maxPowerRef.current,
      hr: telemetryAverages.avgHr || 0,
      maxHR: maxHRRef.current,
      cadence: 0,
      distance: 0,
      flowMinutes: flow.totalFlowMinutes,
      peakFlowTier: flow.flowTier,
    });

    if (newMilestones.length > 0) {
      setRideMilestones(newMilestones);
    }

    experienceManager.recordRide();
  }, [elapsedTime, telemetryAverages, flow]);

  useEffect(() => {
    if (showCompletionScreen) {
      recordMilestonesOnCompletion();
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.quizPostRide, "true");
      }
    }
  }, [showCompletionScreen, recordMilestonesOnCompletion]);

  // Real-time milestone detection at each minute boundary.
  useEffect(() => {
    if (!isRiding) {
      shownMilestoneIdsRef.current = new Set();
      prevRideMinuteRef.current = 0;
      return;
    }

    const currentMinute = Math.floor(elapsedTime / 60);
    if (currentMinute <= prevRideMinuteRef.current || currentMinute <= 0) return;
    prevRideMinuteRef.current = currentMinute;

    const milestoneCheck = milestonesAndStreaks.detectAndRecordMilestones({
      duration: elapsedTime / 60,
      avgPower: telemetryAverages.avgPower || 0,
      maxPower: maxPowerRef.current,
      hr: telemetryAverages.avgHr || 0,
      maxHR: maxHRRef.current,
      cadence: 0,
      distance: 0,
      flowMinutes: flow.totalFlowMinutes,
      peakFlowTier: flow.flowTier,
    });

    const newMilestones = milestoneCheck.filter(
      (m) => !shownMilestoneIdsRef.current.has(m.id)
    );

    if (newMilestones.length === 0) return;

    const tierOrder = ["bronze", "silver", "gold", "platinum", "diamond"] as const;
    newMilestones.sort((a, b) => tierOrder.indexOf(b.tier) - tierOrder.indexOf(a.tier));

    const milestone = newMilestones[0];
    shownMilestoneIdsRef.current.add(milestone.id);

    const tierIcon =
      milestone.tier === "diamond" || milestone.tier === "platinum"
        ? "◆"
        : milestone.tier === "gold"
          ? "●"
          : milestone.tier === "silver"
            ? "●"
            : "●";

    setShowMilestone({
      title: `${tierIcon} ${milestone.title}`,
      subtitle: milestone.description,
    });

    const timeout = setTimeout(() => setShowMilestone(null), 2000);
    return () => clearTimeout(timeout);
  }, [elapsedTime, isRiding, telemetryAverages, flow, setShowMilestone]);

  return {
    maxPowerRef,
    maxHRRef,
    peakEffortRef,
    rideMilestones,
    reset,
  };
}
