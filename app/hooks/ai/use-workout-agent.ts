"use client";

/**
 * useWorkoutAgent - Unified AI Coaching Agent
 * 
 * Core Principles:
 * - CONSOLIDATION: Merges telemetry analysis, reasoning, and voice control
 * - DRY: Single source of truth for agent behavior
 * - MODULAR: Composable agent logic
 */

import { useState, useEffect, useCallback } from "react";
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
  const { rhythm } = useHaptic();
  const [socialEvents, setSocialEvents] = useState<Array<{ id: string; type: any; message: string; timestamp: number }>>([]);
  
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

  // Cadence Sync Haptics - Pulse when below target RPM
  useEffect(() => {
    if (!isEnabled || !metrics?.cadence || !currentInterval?.targetRpm) return;
    const [minRpm] = currentInterval.targetRpm;
    
    if (metrics.cadence < minRpm - 5) {
      // Pulse at target cadence to help rider find the beat
      rhythm(minRpm, 3000);
    }
  }, [isEnabled, metrics?.cadence, currentInterval, rhythm]);

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
  const handleVoiceCommand = useCallback((parsed: any) => {
    if (!parsed.action) return;

    addLog(`Voice Command Recognized: ${parsed.rawText}`, "info");

    switch (parsed.action) {
      case "increase_resistance":
        playSound?.("resistanceUp");
        setResistance?.(metrics?.resistance ? Math.min(100, metrics.resistance + 10) : 50);
        // Haptic: Two short pulses for increase
        if (typeof window !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
        break;
      case "decrease_resistance":
        playSound?.("resistanceDown");
        setResistance?.(metrics?.resistance ? Math.max(0, metrics.resistance - 10) : 20);
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
  }, [metrics, setResistance, addLog, playSound]);

  const { isListening, startListening, stopListening } = useVoiceCommands({
    onCommand: handleVoiceCommand,
    continuous: true,
  });

  // 4. Trigger Adaptive Reasoning Loop
  useEffect(() => {
    if (!isEnabled || !metrics) return;

    // Adaptive frequency based on intensity
    // High intensity (HR > 150) = reason every 15s
    // Recovery (HR < 120) = reason every 30s
    const hr = metrics.heartRate || 0;
    const intervalMs = hr > 150 ? 15000 : hr < 120 ? 30000 : 20000;

    const interval = setInterval(() => {
      // Phase 2: Inject instructor style into reasoning context
      const savedAnchors = typeof window !== 'undefined' 
        ? JSON.parse(localStorage.getItem("instructor_style_anchors") || "[]") 
        : [];

      const styleContext = {
        instructorName: instructorProfile?.name || agentName,
        teachingStyle: instructorProfile?.bio || personality,
        specialties: instructorProfile?.specialties || [],
        styleAnchors: savedAnchors,
      };

      // Phase 3: Agent Gossip - Mock data for other live classes
      const gossipContext = [
        { classId: "sunset-climb", riders: 48, capacity: 50, status: "ending_soon" },
        { classId: "neon-sprint", riders: 12, capacity: 50, status: "starting_now" }
      ];

      reason({
        telemetry: {
          avgBpm: metrics.heartRate,
          resistance: metrics.resistance || 0,
          duration: 0, // Should be passed from parent
        },
        market: marketStats,
        recentDecisions: thoughtLog.slice(0, 3),
        styleContext,
        // @ts-ignore - Gossip context for cross-class coordination
        gossipContext,
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isEnabled, metrics, instructorProfile, personality, reason, thoughtLog]);

  // Auto-start voice listening when enabled
  useEffect(() => {
    if (isEnabled) {
      startListening().catch(console.error);
    } else {
      stopListening();
    }
  }, [isEnabled, startListening, stopListening]);

  // 5. Social Agency: Proactive Rider Outreach (Phase 3+)
  useEffect(() => {
    if (!isEnabled || !metrics) return;

    // Simulate outreach every 45s based on effort (using power/wBal as proxy)
    const interval = setInterval(() => {
      const power = metrics.power || 0;
      const wBal = metrics.wBalPercentage || 100;
      
      if (power > 250 || wBal < 30) {
        const msg = `Recommending "Elite Recovery" class to top performer.`;
        addLog(`Social Agency: ${msg}`, "info");
        setSocialEvents(prev => [{
          id: Math.random().toString(36).substring(2, 11),
          type: "recommendation",
          message: msg,
          timestamp: Date.now()
        }, ...prev].slice(0, 3));
      } else if (power < 100 && wBal > 90) {
        const msg = `Sending "Keep it up" nudge to struggling rider.`;
        addLog(`Social Agency: ${msg}`, "alert");
        setSocialEvents(prev => [{
          id: Math.random().toString(36).substring(2, 11),
          type: "nudge",
          message: msg,
          timestamp: Date.now()
        }, ...prev].slice(0, 3));
      }
    }, 45000);

    return () => clearInterval(interval);
  }, [isEnabled, metrics, addLog]);

  return {
    aiLogs,
    reasonerState,
    lastDecision,
    thoughtLog,
    isListening,
    socialEvents,
  };
}
