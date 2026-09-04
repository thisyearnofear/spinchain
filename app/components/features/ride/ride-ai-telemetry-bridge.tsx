"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTelemetryStore, selectTelemetrySnapshot } from "@/app/stores/telemetry-store";
import { useCoachingStore } from "@/app/stores/coaching-store";
import { useAiInstructor } from "@/app/hooks/ai/use-ai-instructor";
import { useLLMCoaching } from "@/app/hooks/ai/use-llm-coaching";
import { usePushLiveTelemetry } from "@/app/hooks/common/use-live-telemetry";
import { useRideCoordinator } from "@/app/engines/use-ride-coordinator";
import type { ClassWithRoute } from "@/app/hooks/evm/use-class-data";
import type { WorkoutInterval } from "@/app/lib/workout-plan";

/**
 * RideAiTelemetryBridge — owns the telemetry-snapshot-driven side effects
 * (rule-based AI instructor, LLM coaching, live telemetry push to the
 * instructor view) in an isolated component tree.
 *
 * telemetrySnapshot gets a new object identity on every telemetry commit
 * (up to 10Hz on high-tier desktop). Subscribing to it directly from the
 * root page re-rendered the whole ride page at that rate. This
 * component renders nothing — it exists purely to scope that subscription
 * away from the root.
 */
export function RideAiTelemetryBridge({
  isRiding,
  isPracticeMode,
  classId,
  classData,
  currentInterval,
  elapsedTime,
  coordinatorRef,
}: {
  isRiding: boolean;
  isPracticeMode: boolean;
  classId: string;
  classData: ClassWithRoute | null;
  currentInterval: WorkoutInterval | null;
  elapsedTime: number;
  coordinatorRef: React.RefObject<ReturnType<typeof useRideCoordinator> | null>;
}) {
  const telemetrySnapshot = useTelemetryStore(selectTelemetrySnapshot);

  // ─── AI Instructor (personality-driven rule-based coaching) ───
  const [suiSessionId, setSuiSessionId] = useState<string | null>(null);
  useEffect(() => {
    if (!isRiding) {
      setSuiSessionId(null);
      return;
    }
    const interval = setInterval(() => {
      const state = coordinatorRef.current?.getSuiSessionState?.();
      if (state?.sessionId && !state.sessionId.startsWith("pending-")) {
        setSuiSessionId(state.sessionId);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isRiding, coordinatorRef]);

  const aiInstructorMetrics = useMemo(
    () =>
      isRiding
        ? {
            power: telemetrySnapshot.power,
            cadence: telemetrySnapshot.cadence,
            heartRate: telemetrySnapshot.heartRate,
            speed: telemetrySnapshot.speed,
            distance: telemetrySnapshot.distance,
            resistance: telemetrySnapshot.resistance,
            wBal: telemetrySnapshot.wBal,
            wBalPercentage: telemetrySnapshot.wBalPercentage,
            timestamp: telemetrySnapshot.timestamp,
          }
        : null,
    [isRiding, telemetrySnapshot],
  );
  const aiInstructor = useAiInstructor({
    agentName: "Coach",
    personality: "data",
    sessionObjectId: suiSessionId,
    metrics: aiInstructorMetrics,
    currentInterval,
    isEnabled: isRiding,
  });

  // Forward AI instructor logs to coaching store for UI display
  const setAiLogs = useCoachingStore((s) => s.setAiLogs);
  useEffect(() => {
    if (aiInstructor.logs.length > 0) {
      setAiLogs(
        aiInstructor.logs.map((log) => ({
          type: log.type === "action" ? "action" : log.type === "alert" ? "correction" : "observation",
          message: log.message,
          timestamp: log.timestamp,
        })),
      );
    }
  }, [aiInstructor.logs, setAiLogs]);

  // ─── LLM Coaching (periodic AI-powered coaching via /api/ai/chat) ──
  const aiMeta = classData?.metadata?.ai as { systemPromptCid?: string } | undefined;
  useLLMCoaching({
    enabled: isRiding,
    personality: "data",
    systemPromptCid: aiMeta?.systemPromptCid,
    getBus: () => coordinatorRef.current?.getCoordinator()?.bus ?? null,
  });

  // ─── Push live telemetry to server for instructor view (throttled) ───
  const { pushTelemetry, clearTelemetry } = usePushLiveTelemetry(isRiding && !isPracticeMode ? classId : null);
  useEffect(() => {
    if (!isRiding) return;
    pushTelemetry({
      heartRate: telemetrySnapshot.heartRate,
      power: telemetrySnapshot.power,
      cadence: telemetrySnapshot.cadence,
      effort: telemetrySnapshot.effort,
      elapsedSec: elapsedTime,
    });
  }, [isRiding, telemetrySnapshot, elapsedTime, pushTelemetry]);

  // Clear live telemetry on unmount or ride end
  const isRidingRef = useRef(isRiding);
  useEffect(() => {
    isRidingRef.current = isRiding;
  }, [isRiding]);
  useEffect(() => {
    return () => {
      if (isRidingRef.current) clearTelemetry();
    };
  }, [clearTelemetry]);

  return null;
}
