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
  playSound: (sound: string) => void;
  speak: (text: string, emotion: string) => void;
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

  // Interval transition: announce phase changes
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

  // Countdown warning at 5s before interval ends
  useEffect(() => {
    if (!isRiding || !workoutPlan || !currentInterval) return;
    if (intervalRemaining <= 5 && intervalRemaining > 4) {
      playSound("countdown");
    }
  }, [isRiding, workoutPlan, currentInterval, intervalRemaining, playSound]);

  // Speak AI instructor actions
  useEffect(() => {
    if (aiLogs.length === 0) return;
    const latest = aiLogs[0];
    if (latest.type === "action" && !isSpeaking) {
      speak(latest.message, "intense");
      showMessage(latest.message);
    }
  }, [aiLogs, isSpeaking, speak, showMessage]);

  // Cadence drift detection — nudge if below target RPM for >8s
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

  // Announce story beats
  const announceStoryBeat = useCallback((beat: { progress: number; label: string; type: string }) => {
    const beatKey = `${beat.progress}-${beat.label}`;
    if (lastSpokenBeatRef.current === beatKey) return;
    lastSpokenBeatRef.current = beatKey;

    if (beat.type === "sprint") playSound("sprint");
    else if (beat.type === "climb") playSound("climb");
    else if (beat.type === "rest") playSound("recover");

    const emotion = beat.type === "sprint" ? "intense"
      : beat.type === "climb" ? "focused"
        : beat.type === "rest" ? "calm"
          : "focused";
    speak(beat.label, emotion);
    showMessage(beat.label);
  }, [playSound, speak, showMessage]);

  const reset = useCallback(() => {
    lastSpokenBeatRef.current = null;
    lastIntervalRef.current = -1;
  }, []);

  return {
    lastCoachMessage,
    announceStoryBeat,
    reset,
  };
}
