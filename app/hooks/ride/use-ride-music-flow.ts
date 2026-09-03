"use client";

import { useEffect, useRef } from "react";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { useCoachingStore } from "@/app/stores/coaching-store";
import { useFlowState, type FlowStateEvent } from "@/app/lib/flow-state";
import { musicEngine } from "@/app/lib/music-engine";
import { useHaptic } from "@/app/hooks/use-haptic";
import { useSensorySync } from "@/app/hooks/ride/use-sensory-sync";
import type { WorkoutInterval } from "@/app/lib/workout-plan";

/**
 * useRideMusicFlow
 *
 * Encapsulates the flow-state engine, telemetry→flow feed, music transitions,
 * TTS ducking, haptic/audio choreography, and sensory sync. Returns the flow
 * object so the page can read `flow.flowTier` for visuals and the HUD.
 */
export function useRideMusicFlow({
  isRiding,
  currentInterval,
}: {
  isRiding: boolean;
  currentInterval: WorkoutInterval | null;
}) {
  const haptic = useHaptic();

  // Flow engine: inputs are pushed via telemetry subscription, not re-render.
  const flow = useFlowState(0, 0, 60);

  // Keep the latest setInputs ref so the telemetry subscription never stale-closes.
  const setInputsRef = useRef(flow.setInputs);
  useEffect(() => {
    setInputsRef.current = flow.setInputs;
  }, [flow.setInputs]);

  // Subscription is intentionally set up once; resubscribing on every flow
  // tier change would churn the telemetry listener for no benefit.
  useEffect(
    () =>
      useTelemetryStore.subscribe((s) => {
        setInputsRef.current(s.snapshot.power, s.snapshot.heartRate);
      }),
    [],
  );

  // Register flow event handler → coach channel + haptic + music.
  const registerFlowEventHandler = flow.registerFlowEventHandler;
  useEffect(() => {
    registerFlowEventHandler((event: FlowStateEvent) => {
      if (event.message) {
        const coachingStore = useCoachingStore.getState();
        coachingStore.setAiLogs([
          {
            type: "observation",
            message: event.message,
            timestamp: Date.now(),
          },
        ]);
      }

      if (event.type === "tier-rise" || event.type === "peak") {
        haptic.trigger(event.tier === 4 ? "success" : "warning");
      }

      if (musicEngine) {
        musicEngine.updateFlowState(event.tier);
      }
    });
  }, [registerFlowEventHandler, haptic]);

  // Music phase transitions based on interval phase.
  const currentMusicPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isRiding || !currentInterval) return;
    const phase = currentInterval.phase ?? "interval";
    if (phase !== currentMusicPhaseRef.current) {
      currentMusicPhaseRef.current = phase;
      musicEngine.transitionToPhase(phase);
    }
  }, [currentInterval, isRiding]);

  // Update music flow state as flow tier changes.
  useEffect(() => {
    if (isRiding && musicEngine) {
      musicEngine.updateFlowState(flow.flowTier);
    }
  }, [flow.flowTier, isRiding]);

  // TTS ducking.
  const coachIsSpeaking = useCoachingStore((s) => s.isSpeaking);
  const prevSpeakingRef = useRef(false);
  useEffect(() => {
    if (coachIsSpeaking && !prevSpeakingRef.current) {
      musicEngine.startDucking();
    } else if (!coachIsSpeaking && prevSpeakingRef.current) {
      musicEngine.stopDucking();
    }
    prevSpeakingRef.current = coachIsSpeaking;
  }, [coachIsSpeaking]);

  // Sensory sync (audio + visual + haptic choreography).
  useSensorySync();

  return flow;
}
