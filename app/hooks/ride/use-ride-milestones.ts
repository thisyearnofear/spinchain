"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { useRideModalStore } from "@/app/stores/ride-modal-store";
import { milestonesAndStreaks, type SessionMilestone } from "@/app/lib/milestones";
import { experienceManager } from "@/app/lib/experience-level";
import { STORAGE_KEYS } from "@/app/lib/analytics/ride-history";
import { haptic } from "@/app/hooks/use-haptic";
import { playFirstHitSfx } from "@/app/lib/ceremony-sfx";
import {
  MILESTONE_COOLDOWN_MS,
  shouldShowMinuteMilestone,
} from "@/app/lib/milestone-throttle";
import type { useFlowState } from "@/app/lib/flow-state";

interface TelemetryAverages {
  avgPower?: number;
  avgHr?: number;
  avgEffort?: number;
}


/** Cadence / power that counts as a "hard pedal" for first-hit dopamine. */
const HARD_PEDAL_CADENCE = 90;
const HARD_PEDAL_POWER = 200;



/**
 * useRideMilestones
 *
 * Owns peak telemetry tracking, ride-completion milestone recording, and
 * real-time milestone popups. Keeps refs off React state so the page doesn't
 * re-render every second for max-value updates.
 *
 * First dopamine (compressed demo): celebrate the first flow-tier hit and/or
 * first hard pedal immediately — not only minute-boundary duration badges.
 * Minute-boundary overlays are wall-clock throttled so practice's accelerated
 * clock (class-minute ≈ 1.5s wall) cannot spam.
 */
export function useRideMilestones({
  isRiding,
  elapsedTime,
  showCompletionScreen,
  telemetryAverages,
  flow,
  reducedMotion = false,
}: {
  isRiding: boolean;
  elapsedTime: number;
  showCompletionScreen: boolean;
  telemetryAverages: TelemetryAverages;
  flow: ReturnType<typeof useFlowState>;
  reducedMotion?: boolean;
}) {
  const maxPowerRef = useRef(0);
  const maxHRRef = useRef(0);
  const peakEffortRef = useRef(0);
  const [rideMilestones, setRideMilestones] = useState<SessionMilestone[]>([]);

  const shownMilestoneIdsRef = useRef<Set<string>>(new Set());
  const prevRideMinuteRef = useRef(0);
  const lastOverlayAtRef = useRef(0);
  const firstFlowCelebratedRef = useRef(false);
  const firstHardPedalCelebratedRef = useRef(false);
  // Shared gate so first-flow and first-hard-pedal don't both buzz/chime.
  const firstDopamineCelebratedRef = useRef(false);
  const setShowMilestone = useRideModalStore((s) => s.setShowMilestone);

  const showOverlay = useCallback(
    (title: string, subtitle: string, opts?: { force?: boolean; durationMs?: number }) => {
      const now = Date.now();
      if (!opts?.force && now - lastOverlayAtRef.current < MILESTONE_COOLDOWN_MS) {
        return null as ReturnType<typeof setTimeout> | null;
      }
      lastOverlayAtRef.current = now;
      setShowMilestone({ title, subtitle });
      return setTimeout(
        () => setShowMilestone(null),
        opts?.durationMs ?? (reducedMotion ? 900 : 2000),
      );
    },
    [setShowMilestone, reducedMotion],
  );

  const reset = useCallback(() => {
    maxPowerRef.current = 0;
    maxHRRef.current = 0;
    peakEffortRef.current = 0;
    shownMilestoneIdsRef.current = new Set();
    prevRideMinuteRef.current = 0;
    lastOverlayAtRef.current = 0;
    firstFlowCelebratedRef.current = false;
    firstHardPedalCelebratedRef.current = false;
    firstDopamineCelebratedRef.current = false;
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

  // First dopamine: flow tier >= 1 (Focused+)
  useEffect(() => {
    if (!isRiding || firstFlowCelebratedRef.current) return;
    if (firstDopamineCelebratedRef.current) return;
    if (flow.flowTier < 1) return;

    firstFlowCelebratedRef.current = true;
    firstDopamineCelebratedRef.current = true;
    shownMilestoneIdsRef.current.add("first-flow");

    const label = flow.flowTier >= 2 ? "IN FLOW" : "FOCUSED";
    const timeout = showOverlay(`✨ ${label}`, "First flow moment — keep it going", {
      force: true,
      durationMs: reducedMotion ? 800 : 1800,
    });

    if (!reducedMotion) {
      haptic("success");
      playFirstHitSfx();
    } else {
      haptic("light");
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isRiding, flow.flowTier, showOverlay, reducedMotion]);

  // First dopamine: hard pedal
  useEffect(() => {
    if (!isRiding || firstHardPedalCelebratedRef.current) return;

    const id = setInterval(() => {
      if (firstHardPedalCelebratedRef.current) return;
      const s = useTelemetryStore.getState().snapshot;
      const hard =
        s.cadence >= HARD_PEDAL_CADENCE || s.power >= HARD_PEDAL_POWER;
      if (!hard) return;

      firstHardPedalCelebratedRef.current = true;
      shownMilestoneIdsRef.current.add("first-hard-pedal");

      // If another first-dopamine moment already fired, don't double buzz/chime.
      if (firstDopamineCelebratedRef.current) return;
      firstDopamineCelebratedRef.current = true;

      showOverlay("⚡ HARD EFFORT", "First strong pedal — world unlocked", {
        force: true,
        durationMs: reducedMotion ? 800 : 1600,
      });

      if (!reducedMotion) {
        haptic("success");
        playFirstHitSfx();
      } else {
        haptic("light");
      }
    }, 250);

    return () => clearInterval(id);
  }, [isRiding, showOverlay, reducedMotion]);

  // Real-time milestone detection at each minute boundary (throttled).
  useEffect(() => {
    if (!isRiding) {
      shownMilestoneIdsRef.current = new Set();
      prevRideMinuteRef.current = 0;
      firstFlowCelebratedRef.current = false;
      firstHardPedalCelebratedRef.current = false;
      firstDopamineCelebratedRef.current = false;
      lastOverlayAtRef.current = 0;
      return;
    }

    const currentMinute = Math.floor(elapsedTime / 60);
    if (currentMinute <= prevRideMinuteRef.current || currentMinute <= 0) return;
    prevRideMinuteRef.current = currentMinute;

    // Wall-clock throttle — practice advances ~1 class-minute per 1.5s wall.
    if (
      !shouldShowMinuteMilestone({
        lastOverlayAt: lastOverlayAtRef.current,
      })
    ) {
      return;
    }

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

    const timeout = showOverlay(
      `${tierIcon} ${milestone.title}`,
      milestone.description,
    );

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [elapsedTime, isRiding, telemetryAverages, flow, showOverlay]);

  return {
    maxPowerRef,
    maxHRRef,
    peakEffortRef,
    rideMilestones,
    reset,
  };
}
