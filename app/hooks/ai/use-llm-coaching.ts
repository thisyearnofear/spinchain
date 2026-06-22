"use client";

import { useEffect, useRef, useCallback } from "react";
import { getAIService } from "@/app/lib/ai-service";
import type { CoachingContext, CoachingResponse } from "@/app/lib/ai-types";
import { useTelemetryStore, selectTelemetrySnapshot } from "@/app/stores/telemetry-store";
import { useRideStore } from "@/app/stores/ride-store";
import { useCoachingStore } from "@/app/stores/coaching-store";

const LLM_COACHING_INTERVAL_MS = 60_000; // 60 seconds

function classifyPerformance(
  heartRate: number,
  targetHr: number,
  power: number,
): CoachingContext["recentPerformance"] {
  if (targetHr === 0) return "on";
  const ratio = heartRate / targetHr;
  if (ratio > 1.15 || power > 350) return "crushing";
  if (ratio > 1.05) return "above";
  if (ratio < 0.85) return "below";
  return "on";
}

function classifyFatigue(
  wBalPercentage: number,
): CoachingContext["fatigueLevel"] {
  if (wBalPercentage < 30) return "high";
  if (wBalPercentage < 60) return "moderate";
  return "low";
}

export function useLLMCoaching({
  enabled,
  systemPromptCid,
  targetHeartRate = 150,
  personality = "data",
}: {
  enabled: boolean;
  systemPromptCid?: string;
  targetHeartRate?: number;
  personality?: "zen" | "drill-sergeant" | "data";
}) {
  const snapshot = useTelemetryStore(selectTelemetrySnapshot);
  const rideProgress = useRideStore((s) => s.rideProgress);
  const currentInterval = useCoachingStore((s) => s.currentInterval);
  const setLastCoachMessage = useCoachingStore((s) => s.setLastCoachMessage);
  const setIsSpeaking = useCoachingStore((s) => s.setIsSpeaking);

  const conversationRef = useRef<Array<{ role: "rider" | "coach"; message: string }>>([]);
  const lastCallRef = useRef(0);

  const callLLM = useCallback(async () => {
    if (!enabled || snapshot.heartRate === 0) return;

    const context: CoachingContext = {
      riderHeartRate: Math.round(snapshot.heartRate),
      targetHeartRate,
      currentResistance: Math.round(snapshot.resistance),
      currentCadence: Math.round(snapshot.cadence),
      workoutProgress: rideProgress,
      recentPerformance: classifyPerformance(snapshot.heartRate, targetHeartRate, snapshot.power),
      fatigueLevel: classifyFatigue(snapshot.wBalPercentage ?? 100),
      personality,
      systemPromptCid,
      routeStoryBeat: currentInterval?.phase,
    };

    try {
      setIsSpeaking(true);
      const aiService = getAIService({ preferredProvider: "gemini" });
      const response: CoachingResponse & { _meta?: { provider: string } } =
        await aiService.getCoaching(context, conversationRef.current.slice(-3));

      setLastCoachMessage(response.message);
      conversationRef.current.push({ role: "coach", message: response.message });

      // Keep conversation history bounded
      if (conversationRef.current.length > 20) {
        conversationRef.current = conversationRef.current.slice(-10);
      }
    } catch (err) {
      console.warn("[LLMCoaching] Failed, falling back to rule-based:", err);
    } finally {
      setIsSpeaking(false);
    }
  }, [
    enabled,
    snapshot.heartRate,
    snapshot.power,
    snapshot.resistance,
    snapshot.cadence,
    snapshot.wBalPercentage,
    rideProgress,
    targetHeartRate,
    personality,
    systemPromptCid,
    currentInterval,
    setLastCoachMessage,
    setIsSpeaking,
  ]);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastCallRef.current >= LLM_COACHING_INTERVAL_MS) {
        lastCallRef.current = now;
        callLLM();
      }
    }, 5000); // Check every 5s, but only call every 60s

    return () => clearInterval(interval);
  }, [enabled, callLLM]);

  return { callLLM };
}
