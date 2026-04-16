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

  // Stabilize all rapidly-changing values via refs to prevent infinite re-render loops
  const aiLogsRef = useRef(aiLogs);
  aiLogsRef.current = aiLogs;
  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;
  const lastDecisionRef = useRef(lastDecision);
  lastDecisionRef.current = lastDecision;
  const rideProgressRef = useRef(rideProgress);
  rideProgressRef.current = rideProgress;
  const telemetryCadenceRef = useRef(telemetryCadence);
  telemetryCadenceRef.current = telemetryCadence;
  const currentIntervalRef = useRef(currentInterval);
  currentIntervalRef.current = currentInterval;
  const intervalRemainingRef = useRef(intervalRemaining);
  intervalRemainingRef.current = intervalRemaining;
  const speakRef = useRef(speak);
  speakRef.current = speak;
  const playSoundRef = useRef(playSound);
  playSoundRef.current = playSound;

  // Track the last aiLogs length to detect genuinely new entries
  const lastAiLogsLengthRef = useRef(0);

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
      playSoundRef.current("intervalStart");
    } else if (interval.phase === "recovery" || interval.phase === "cooldown") {
      playSoundRef.current("recover");
    } else if (interval.phase === "interval") {
      playSoundRef.current("resistanceUp");
    }

    if (interval.coachCue) {
      const emotion = PHASE_DEFAULTS[interval.phase].coachEmotion;
      speakRef.current(interval.coachCue, emotion);
      showMessage(interval.coachCue);
    }
  }, [isRiding, workoutPlan, currentIntervalIndex, showMessage]);

  // 2. Countdown warning at 5s before interval ends (poll via interval)
  useEffect(() => {
    if (!isRiding || !workoutPlan) return;
    const id = setInterval(() => {
      const rem = intervalRemainingRef.current;
      const ci = currentIntervalRef.current;
      if (ci && rem <= 5 && rem > 4) {
        playSoundRef.current("countdown");
      }
    }, 500);
    return () => clearInterval(id);
  }, [isRiding, workoutPlan]);

  // 3. Speak AI instructor actions — poll for new entries instead of depending on array ref
  useEffect(() => {
    if (!aiActive) {
      lastAiLogsLengthRef.current = 0;
      return;
    }
    const id = setInterval(() => {
      const logs = aiLogsRef.current;
      if (logs.length > lastAiLogsLengthRef.current && logs.length > 0) {
        lastAiLogsLengthRef.current = logs.length;
        const latest = logs[0];
        if (latest.type === "action" && !isSpeakingRef.current) {
          const emotion = lastDecisionRef.current?.emotion || "intense";
          speakRef.current(latest.message, emotion);
          showMessage(latest.message);
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [aiActive, showMessage]);

  // 4. Cadence drift detection — poll instead of depending on telemetryCadence
  useEffect(() => {
    if (!isRiding) return;
    const id = setInterval(() => {
      const ci = currentIntervalRef.current;
      if (!ci?.targetRpm) return;
      const [minRpm] = ci.targetRpm;
      const cadence = telemetryCadenceRef.current;
      const now = Date.now();
      const delta = now - lastCadenceCheckRef.current;
      lastCadenceCheckRef.current = now;

      if (cadence < minRpm - 10) {
        cadenceDriftMsRef.current += delta;
      } else {
        cadenceDriftMsRef.current = 0;
      }

      const intervalKey = `${currentIntervalIndex}-${ci.phase}`;
      if (cadenceDriftMsRef.current >= 8000 && lastDriftNudgeRef.current !== intervalKey) {
        lastDriftNudgeRef.current = intervalKey;
        cadenceDriftMsRef.current = 0;
        const nudge = "Pick up the pace!";
        speakRef.current(nudge, "intense");
        showMessage(nudge);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [isRiding, currentIntervalIndex, showMessage]);

  // 5. Announce story beats — poll rideProgress via ref
  useEffect(() => {
    if (!isRiding || !storyBeats.length) return;

    const id = setInterval(() => {
      const progress = rideProgressRef.current;
      const currentBeat = storyBeats.find((beat) => {
        const beatProgress = beat.progress * 100;
        return progress >= beatProgress && progress < beatProgress + 3;
      });

      if (!currentBeat) return;

      const beatKey = `${currentBeat.progress}-${currentBeat.label}`;
      if (lastSpokenBeatRef.current === beatKey) return;
      lastSpokenBeatRef.current = beatKey;

      if (currentBeat.type === "sprint") playSoundRef.current("sprint");
      else if (currentBeat.type === "climb") playSoundRef.current("climb");
      else if (currentBeat.type === "rest") playSoundRef.current("recover");

      const emotion = currentBeat.type === "sprint" ? "intense"
        : currentBeat.type === "climb" ? "focused"
          : currentBeat.type === "rest" ? "calm"
            : "focused";
      speakRef.current(currentBeat.label, emotion);
      showMessage(currentBeat.label);
    }, 1000);
    return () => clearInterval(id);
  }, [isRiding, storyBeats, showMessage]);

  const reset = useCallback(() => {
    lastSpokenBeatRef.current = null;
    lastIntervalRef.current = -1;
  }, []);

  return {
    lastCoachMessage,
    reset,
  };
}
