"use client";

/**
 * useWorkoutAgent - Unified AI Coaching Agent
 * 
 * Core Principles:
 * - CONSOLIDATION: Merges telemetry analysis, reasoning, and voice control
 * - DRY: Single source of truth for agent behavior
 * - MODULAR: Composable agent logic
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAiInstructor } from "./use-ai-instructor";
import { useAgentReasoner } from "./use-agent-reasoner";
import { useVoiceCommands } from "./use-voice-commands";
import { useHaptic } from "../use-haptic";
import type { FitnessMetrics } from "@/app/lib/ble/types";
import type { WorkoutInterval } from "@/app/lib/workout-plan";

interface UseWorkoutAgentOptions {
  agentName: string;
  personality: "zen" | "drill-sergeant" | "data";
  sessionObjectId: string | null;
  metrics: FitnessMetrics | null;
  currentInterval: WorkoutInterval | null;
  isEnabled?: boolean;
  setResistance?: (level: number) => Promise<boolean>;
  playSound?: (sound: any) => any;
  instructorProfile?: any; // For Phase 2 Training
  marketStats?: {
    ticketsSold: number;
    revenue: number;
    capacity: number;
  };
}

export function useWorkoutAgent({
  agentName,
  personality,
  sessionObjectId,
  metrics,
  currentInterval,
  isEnabled = false,
  setResistance,
  playSound,
  instructorProfile,
  marketStats = { ticketsSold: 0, revenue: 0, capacity: 50 },
}: UseWorkoutAgentOptions) {
  // 1. Real-time Telemetry Analysis (Phase 1)
  const { logs: aiLogs, addLog } = useAiInstructor({
    agentName,
    personality,
    sessionObjectId,
    metrics,
    currentInterval,
    isEnabled,
    setResistance,
  });

  const { rhythm, light: hapticLight } = useHaptic();

  // Stabilize metrics reference to prevent effect churn
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  const [socialEvents, setSocialEvents] = useState<
    Array<{
      id: string;
      type: any;
      message: string;
      timestamp: number;
      from?: string;
    }>
  >([]);

  // Counter for stable, monotonically increasing IDs
  const socialIdCounter = useRef(0);

  const handleHighFive = useCallback(
    (riderId: string) => {
      hapticLight();
      addLog(`Sent high-five to ${riderId}`, "info");
      // Simulate immediate response
      setTimeout(() => {
        const msg = `${riderId} high-fived you back!`;
        setSocialEvents((prev) =>
          [
            {
              id: `hifive-${++socialIdCounter.current}`,
              type: "highfive",
              message: msg,
              timestamp: Date.now(),
              from: riderId,
            },
            ...prev,
          ].slice(0, 3),
        );
        hapticLight();
      }, 2000);
    },
    [hapticLight, addLog],
  );

  // Cadence Sync Haptics - Pulse when below target RPM
  // Uses ref-based polling instead of direct cadence dependency to prevent
  // the effect from re-running on every telemetry update (React #185).
  const cadenceCheckRef = useRef<{ cadence: number; targetRpm: [number, number] } | null>(null);
  // Update ref on every render (cheap) instead of using cadence/targetRpm as effect deps
  if (metrics?.cadence && currentInterval?.targetRpm) {
    cadenceCheckRef.current = { cadence: metrics.cadence, targetRpm: currentInterval.targetRpm };
  } else {
    cadenceCheckRef.current = null;
  }
  useEffect(() => {
    if (!isEnabled) return;
    const id = setInterval(() => {
      const check = cadenceCheckRef.current;
      if (!check) return;
      const { cadence, targetRpm } = check;
      const [minRpm] = targetRpm;
      if (cadence < minRpm - 5) {
        rhythm(minRpm, 3000);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isEnabled, rhythm]);

  // 2. Long-term Strategic Reasoning (Phase 3)
  const { 
    state: reasonerState, 
    lastDecision, 
    thoughtLog, 
    reason 
  } = useAgentReasoner({
    agentName,
    personality,
    enabled: isEnabled,
  });

  // 3. Hands-free Voice Control (Phase 1 Integration)
  // Uses metricsRef instead of metrics directly to prevent callback recreation
  // on every telemetry update, which causes useVoiceCommands to re-initialize (React #185).
  const handleVoiceCommand = useCallback((parsed: any) => {
    if (!parsed.action) return;
    const m = metricsRef.current;

    addLog(`Voice Command Recognized: ${parsed.rawText}`, "info");

    switch (parsed.action) {
      case "increase_resistance":
        playSound?.("resistanceUp");
        setResistance?.(m?.resistance ? Math.min(100, m.resistance + 10) : 50);
        // Haptic: Two short pulses for increase
        if (typeof window !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
        break;
      case "decrease_resistance":
        playSound?.("resistanceDown");
        setResistance?.(m?.resistance ? Math.max(0, m.resistance - 10) : 20);
        // Haptic: One long pulse for decrease
        if (typeof window !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(200);
        }
        break;
      case "pause_workout":
        playSound?.("intervalEnd");
        if (typeof window !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([300, 100, 300]);
        }
        break;
      case "emergency_stop":
        playSound?.("finish");
        if (typeof window !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([500, 100, 500, 100, 500]);
        }
        break;
    }
  }, [setResistance, addLog, playSound]);

  const { isListening, startListening, stopListening } = useVoiceCommands({
    onCommand: handleVoiceCommand,
    continuous: true,
  });

  const startListeningRef = useRef(startListening);
  startListeningRef.current = startListening;
  const stopListeningRef = useRef(stopListening);
  stopListeningRef.current = stopListening;
  const wasEnabledRef = useRef(false);
  const reasonRef = useRef(reason);
  reasonRef.current = reason;
  const agentNameRef = useRef(agentName);
  agentNameRef.current = agentName;
  const personalityRef = useRef(personality);
  personalityRef.current = personality;

  // 4. Trigger Adaptive Reasoning Loop
  const instructorProfileRef = useRef(instructorProfile);
  instructorProfileRef.current = instructorProfile;
  const thoughtLogRef = useRef(thoughtLog);
  thoughtLogRef.current = thoughtLog;
  const marketStatsRef = useRef(marketStats);
  marketStatsRef.current = marketStats;

  useEffect(() => {
    if (!isEnabled) return;

    // Use a fixed interval; read current metrics inside the callback
    const intervalMs = 20000;

    const interval = setInterval(() => {
      const m = metricsRef.current;
      if (!m) return;

      // Phase 2: Inject instructor style into reasoning context
      const savedAnchors = typeof window !== 'undefined' 
        ? JSON.parse(localStorage.getItem("instructor_style_anchors") || "[]") 
        : [];

      const styleContext = {
        instructorName: instructorProfileRef.current?.name || agentNameRef.current,
        teachingStyle: instructorProfileRef.current?.bio || personalityRef.current,
        specialties: instructorProfileRef.current?.specialties || [],
        styleAnchors: savedAnchors,
      };

      // Phase 3: Agent Gossip - Mock data for other live classes
      const gossipContext = [
        { classId: "sunset-climb", riders: 48, capacity: 50, status: "ending_soon" },
        { classId: "neon-sprint", riders: 12, capacity: 50, status: "starting_now" }
      ];

      reasonRef.current({
        telemetry: {
          avgBpm: m.heartRate,
          resistance: m.resistance || 0,
          duration: 0, // Should be passed from parent
        },
        market: marketStatsRef.current,
        recentDecisions: thoughtLogRef.current.slice(0, 3),
        styleContext,
        // @ts-ignore - Gossip context for cross-class coordination
        gossipContext,
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isEnabled]);

  // Auto-start voice listening when enabled
  useEffect(() => {
    if (isEnabled) {
      if (!wasEnabledRef.current) {
        wasEnabledRef.current = true;
        startListeningRef.current().catch(console.error);
      }
      return;
    }

    if (wasEnabledRef.current) {
      wasEnabledRef.current = false;
      stopListeningRef.current();
    }
  }, [isEnabled]);

  // 5. Social Agency: Proactive Rider Outreach (Phase 3+)
  useEffect(() => {
    if (!isEnabled) return;

    // Simulate outreach every 45s based on effort (using power/wBal as proxy)
    const interval = setInterval(() => {
      const m = metricsRef.current;
      if (!m) return;

      const power = m.power || 0;
      const wBal = m.wBalPercentage || 100;
      
      if (power > 250 || wBal < 30) {
        const msg = `Recommending "Elite Recovery" class to top performer.`;
        addLog(`Social Agency: ${msg}`, "info");
        setSocialEvents(prev => [{
          id: `social-${++socialIdCounter.current}`,
          type: "recommendation",
          message: msg,
          timestamp: Date.now()
        }, ...prev].slice(0, 3));
      } else if (power < 100 && wBal > 90) {
        const msg = `Sending "Keep it up" nudge to struggling rider.`;
        addLog(`Social Agency: ${msg}`, "alert");
        setSocialEvents(prev => [{
          id: `social-${++socialIdCounter.current}`,
          type: "nudge",
          message: msg,
          timestamp: Date.now()
        }, ...prev].slice(0, 3));
      }
    }, 45000);

    return () => clearInterval(interval);
  }, [isEnabled, addLog]);

  return {
    aiLogs,
    reasonerState,
    lastDecision,
    thoughtLog,
    isListening,
    socialEvents,
    handleHighFive,
  };
}
