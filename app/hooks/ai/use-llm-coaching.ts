"use client";

import { useEffect, useRef, useCallback } from "react";
import { getAIService } from "@/app/lib/ai-service";
import type { CoachingContext, CoachingResponse } from "@/app/lib/ai-types";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { useRideStore } from "@/app/stores/ride-store";
import { useCoachingStore } from "@/app/stores/coaching-store";
import type { EventBus } from "@/app/engines/event-bus";

const LLM_COACHING_INTERVAL_MS = 60_000; // 60 seconds between LLM calls
const CHECK_INTERVAL_MS = 5_000; // poll every 5 s
const SPEAKING_FALLBACK_MS = 20_000; // hide coach bubble if TTS never fires

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
  getBus,
}: {
  enabled: boolean;
  systemPromptCid?: string;
  targetHeartRate?: number;
  personality?: "zen" | "drill-sergeant" | "data";
  /** Returns the ride's EventBus so LLM lines are voiced by the AudioEngine */
  getBus?: () => EventBus | null | undefined;
}) {
  const setLastCoachMessage = useCoachingStore((s) => s.setLastCoachMessage);
  const setIsSpeaking = useCoachingStore((s) => s.setIsSpeaking);

  const conversationRef = useRef<Array<{ role: "rider" | "coach"; message: string }>>([]);
  const lastCallRef = useRef(0);
  const inFlightRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mirror all mutable inputs into a ref so callLLM stays referentially
  // stable and the polling interval is never torn down by re-renders.
  const propsRef = useRef({ enabled, systemPromptCid, targetHeartRate, personality, getBus });
  propsRef.current = { enabled, systemPromptCid, targetHeartRate, personality, getBus };

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const callLLM = useCallback(async () => {
    const { enabled: en, systemPromptCid: cid, targetHeartRate: thr, personality: pers, getBus: bus } =
      propsRef.current;
    if (!en || inFlightRef.current) return;

    // Read latest telemetry imperatively — no reactive subscription needed.
    const snap = useTelemetryStore.getState().snapshot;
    if (!snap || snap.heartRate === 0) return;

    const rideProgress = useRideStore.getState().rideProgress;
    const currentInterval = useCoachingStore.getState().currentInterval;

    const context: CoachingContext = {
      riderHeartRate: Math.round(snap.heartRate),
      targetHeartRate: thr,
      currentResistance: Math.round(snap.resistance),
      currentCadence: Math.round(snap.cadence),
      workoutProgress: rideProgress,
      recentPerformance: classifyPerformance(snap.heartRate, thr, snap.power),
      fatigueLevel: classifyFatigue(snap.wBalPercentage ?? 100),
      personality: pers,
      systemPromptCid: cid,
      routeStoryBeat: currentInterval?.phase,
    };

    inFlightRef.current = true;
    try {
      clearHideTimer();
      setIsSpeaking(true);
      setLastCoachMessage(null); // clear stale text so the HUD doesn't flash the previous line

      const aiService = getAIService();
      const response: CoachingResponse & { _meta?: { provider: string } } =
        await aiService.getCoaching(context, conversationRef.current.slice(-3));

      if (!response?.message) {
        setIsSpeaking(false);
        return;
      }

      setLastCoachMessage(response.message);
      conversationRef.current.push({ role: "coach", message: response.message });

      // Voice the LLM line through the ride's audio path (EventBus →
      // AudioEngine speak → cache / edge LRU / ElevenLabs / system fallback).
      bus?.()?.emit("coaching:message", { text: response.message, source: "llm" });

      // Keep conversation history bounded
      if (conversationRef.current.length > 20) {
        conversationRef.current = conversationRef.current.slice(-10);
      }

      // Safety timeout: if the AudioEngine never emits audio:speaking(false)
      // (e.g. ElevenLabs unconfigured, no system fallback), hide the bubble.
      hideTimerRef.current = setTimeout(() => setIsSpeaking(false), SPEAKING_FALLBACK_MS);
    } catch (err) {
      console.warn("[LLMCoaching] Failed, falling back to rule-based:", err);
      setIsSpeaking(false);
    } finally {
      inFlightRef.current = false;
    }
  }, [setLastCoachMessage, setIsSpeaking, clearHideTimer]);

  useEffect(() => {
    if (!enabled) return;

    // Seed lastCall so the first LLM nudge arrives ~60 s into the ride,
    // not 5 s in.
    lastCallRef.current = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastCallRef.current >= LLM_COACHING_INTERVAL_MS) {
        lastCallRef.current = now;
        callLLM();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      clearHideTimer();
    };
  }, [enabled, callLLM, clearHideTimer]);

  return { callLLM };
}
