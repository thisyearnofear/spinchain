"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { WorkoutPlan, IntervalPhase } from "../../lib/workout-plan";
import { PHASE_DEFAULTS } from "../../lib/workout-plan";

interface UseRideCoachOptions {
  isRiding: boolean;
  aiActive: boolean;
  workoutPlan: WorkoutPlan | null;
  currentIntervalIndex: number;
  currentInterval: { phase: IntervalPhase; coachCue?: string; targetRpm?: [number, number]; durationSeconds: number } | null;
  intervalRemaining: number;
  telemetryCadence: number;
  aiLogs: { type: string; message: string; timestamp: number }[];
  isSpeaking: boolean;
  playSound: (sound: any) => void;
  speak: (text: string, emotion: any) => void;
  rideProgress?: number;
  storyBeats?: Array<{ progress: number; label: string; type: string }>;
  lastDecision?: {
    thoughtProcess: string;
    action?: string;
    confidence?: number;
    emotion?: string;
  } | null;
}

export function useRideCoach({
  isRiding,
  aiActive,
  workoutPlan,
  currentIntervalIndex,
  currentInterval,
  intervalRemaining,
  telemetryCadence,
  aiLogs,
  isSpeaking,
  playSound,
  speak,
  rideProgress = 0,
  storyBeats = [],
  lastDecision,
}: UseRideCoachOptions) {
  const [lastCoachMessage, setLastCoachMessage] = useState<string | null>(null);
  const coachMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastIntervalRef = useRef<number>(-1);
  const lastSpokenBeatRef = useRef<string | null>(null);

  // Cadence drift detection
  const cadenceDriftMsRef = useRef<number>(0);
  const lastCadenceCheckRef = useRef<number>(Date.now());
  const lastDriftNudgeRef = useRef<string | null>(null);

  const showMessage = useCallback((message: string, durationMs = 4000) => {
    setLastCoachMessage(message);
    if (coachMessageTimerRef.current) clearTimeout(coachMessageTimerRef.current);
    coachMessageTimerRef.current = setTimeout(() => setLastCoachMessage(null), durationMs);
  }, []);

  // 1. Interval transition: announce phase changes
  useEffect(() => {
    if (!isRiding || !workoutPlan || currentIntervalIndex < 0) return;
    if (lastIntervalRef.current === currentIntervalIndex) return;

    const prevIndex = lastIntervalRef.current;
    lastIntervalRef.current = currentIntervalIndex;

    if (prevIndex === -1) return;

    const interval = workoutPlan.intervals[currentIntervalIndex];
    if (!interval) return;

    if (interval.phase === "sprint") {
      playSound("intervalStart");
    } else if (interval.phase === "recovery" || interval.phase === "cooldown") {
      playSound("recover");
    } else if (interval.phase === "interval") {
      playSound("resistanceUp");
    }

    if (interval.coachCue) {
      const emotion = PHASE_DEFAULTS[interval.phase].coachEmotion;
      speak(interval.coachCue, emotion);
      showMessage(interval.coachCue);
    }
  }, [isRiding, workoutPlan, currentIntervalIndex, playSound, speak, showMessage]);

  // 2. Countdown warning at 5s before interval ends
  useEffect(() => {
    if (!isRiding || !workoutPlan || !currentInterval) return;
    if (intervalRemaining <= 5 && intervalRemaining > 4) {
      playSound("countdown");
    }
  }, [isRiding, workoutPlan, currentInterval, intervalRemaining, playSound]);

  // 3. Speak AI instructor actions (Real-time coaching)
  useEffect(() => {
    if (!aiActive || aiLogs.length === 0) return;
    const latest = aiLogs[0];
    if (latest.type === "action" && !isSpeaking) {
      // Use agent's chosen emotion if available, fallback to intense
      const emotion = lastDecision?.emotion || "intense";
      speak(latest.message, emotion);
      showMessage(latest.message);
    }
  }, [aiActive, aiLogs, isSpeaking, speak, showMessage, lastDecision]);

  // 4. Cadence drift detection — nudge if below target RPM for >8s
  useEffect(() => {
    if (!isRiding || !currentInterval?.targetRpm) return;
    const [minRpm] = currentInterval.targetRpm;
    const now = Date.now();
    const delta = now - lastCadenceCheckRef.current;
    lastCadenceCheckRef.current = now;

    if (telemetryCadence < minRpm - 10) {
      cadenceDriftMsRef.current += delta;
    } else {
      cadenceDriftMsRef.current = 0;
    }

    const intervalKey = `${currentIntervalIndex}-${currentInterval.phase}`;
    if (cadenceDriftMsRef.current >= 8000 && lastDriftNudgeRef.current !== intervalKey) {
      lastDriftNudgeRef.current = intervalKey;
      cadenceDriftMsRef.current = 0;
      const nudge = "Pick up the pace!";
      speak(nudge, "intense");
      showMessage(nudge);
    }
  }, [isRiding, telemetryCadence, currentInterval, currentIntervalIndex, speak, showMessage]);

  // 5. Announce story beats (Terrain/Environment)
  useEffect(() => {
    if (!isRiding || !storyBeats.length) return;
    
    const currentBeat = storyBeats.find((beat) => {
      const beatProgress = beat.progress * 100;
      return rideProgress >= beatProgress && rideProgress < beatProgress + 3;
    });

    if (!currentBeat) return;
    
    const beatKey = `${currentBeat.progress}-${currentBeat.label}`;
    if (lastSpokenBeatRef.current === beatKey) return;
    lastSpokenBeatRef.current = beatKey;

    if (currentBeat.type === "sprint") playSound("sprint");
    else if (currentBeat.type === "climb") playSound("climb");
    else if (currentBeat.type === "rest") playSound("recover");

    const emotion = currentBeat.type === "sprint" ? "intense"
      : currentBeat.type === "climb" ? "focused"
        : currentBeat.type === "rest" ? "calm"
          : "focused";
    speak(currentBeat.label, emotion);
    showMessage(currentBeat.label);
  }, [isRiding, storyBeats, rideProgress, playSound, speak, showMessage]);

  const reset = useCallback(() => {
    lastSpokenBeatRef.current = null;
    lastIntervalRef.current = -1;
  }, []);

  return {
    lastCoachMessage,
    reset,
  };
}
