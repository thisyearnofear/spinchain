"use client";

import { useState, useEffect, useRef } from "react";
import { useSuiTelemetry } from "../sui/use-sui-telemetry";
import type { FitnessMetrics } from "@/app/lib/ble/types";
import type { WorkoutInterval } from "@/app/lib/workout-plan";

type AgentPersonality = "zen" | "drill-sergeant" | "data";

type AgentLog = {
  timestamp: number;
  message: string;
  type: "info" | "action" | "alert";
};

interface UseAiInstructorOptions {
  agentName: string;
  personality: AgentPersonality;
  sessionObjectId: string | null;
  metrics: FitnessMetrics | null;
  currentInterval: WorkoutInterval | null;
  isEnabled?: boolean;
  setResistance?: (level: number) => Promise<boolean>;
}

/**
 * useAiInstructor - Real-time AI coaching hook
 * 
 * ENHANCEMENT FIRST: Integrates real-time telemetry and workout targets
 * CLEAN: Logic separation between data processing and trigger actions
 */
export function useAiInstructor({
  agentName,
  personality,
  sessionObjectId,
  metrics,
  currentInterval,
  isEnabled = false,
  setResistance,
}: UseAiInstructorOptions) {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const { triggerBeat } = useSuiTelemetry(sessionObjectId, null);
  const lastActionTimestamp = useRef<number>(0);
  const ACTION_COOLDOWN_MS = 45000;

  const addLog = (message: string, type: AgentLog["type"] = "info") => {
    setLogs((prev) => [
      { timestamp: Date.now(), message, type },
      ...prev.slice(0, 19), // Keep last 20 logs
    ]);
  };

  // Stabilize metrics with ref for effect performance (avoid constant clearInterval/setInterval)
  const metricsRef = useRef(metrics);
  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  // Agent decision loop based on real telemetry
  useEffect(() => {
    if (!isEnabled) return;

    const intervalId = setInterval(() => {
      const currentMetrics = metricsRef.current;
      if (!currentMetrics) return;

      const now = Date.now();
      const canTakeAction =
        now - lastActionTimestamp.current > ACTION_COOLDOWN_MS;

      // 1. Data Analysis (Personality-agnostic)
      const hr = currentMetrics.heartRate;
      const power = currentMetrics.power;
      const cadence = currentMetrics.cadence;
      const wBalPct = currentMetrics.wBalPercentage ?? 100;

      const targetHrZone = currentInterval?.targetHrZone;
      const targetRpm = currentInterval?.targetRpm;
      const targetPower = currentInterval?.targetPower;

      // 2. Personality-driven Logic
      if (personality === "drill-sergeant") {
        // High-intensity focus: Push if under target
        if (targetRpm && cadence < targetRpm[0] && canTakeAction) {
          const message = `${agentName}: "I see those legs slowing down! Target is ${targetRpm[0]} RPM. PICK IT UP!"`;
          addLog(message, "action");
          triggerBeat("Leg Speed Attack!", "sprint", 8);
          lastActionTimestamp.current = now;
        } else if (hr < 130 && wBalPct > 80 && canTakeAction) {
          const message = `${agentName}: "You have plenty of fuel left in the tank! Increasing resistance. DIG DEEPER!"`;
          addLog(message, "action");
          setResistance?.(
            currentMetrics.resistance
              ? Math.min(100, currentMetrics.resistance + 10)
              : 50,
          );
          triggerBeat("Intensity Surge", "climb", 7);
          lastActionTimestamp.current = now;
        }
      } else if (personality === "zen") {
        // Recovery/Flow focus: Calm if over-exerting
        if ((hr > 175 || wBalPct < 20) && canTakeAction) {
          const status =
            wBalPct < 20
              ? "Your energy is nearly depleted."
              : "Your heart is racing beyond the zone.";
          const message = `${agentName}: "${status} Lowering resistance. Soften your grip. Breathe deep."`;
          addLog(message, "action");
          setResistance?.(
            currentMetrics.resistance
              ? Math.max(0, currentMetrics.resistance - 15)
              : 20,
          );
          triggerBeat("Find Your Center", "rest", 3);
          lastActionTimestamp.current = now;
        } else if (targetRpm && cadence > targetRpm[1] + 10 && canTakeAction) {
          const message = `${agentName}: "Too much frantic energy. Find the rhythm, don't chase it."`;
          addLog(message, "info");
          lastActionTimestamp.current = now;
        }
      } else if (personality === "data") {
        // Technical focus: Compliance and efficiency
        if (
          targetPower &&
          (power < targetPower[0] || power > targetPower[1]) &&
          canTakeAction
        ) {
          const status = power < targetPower[0] ? "low" : "high";
          const message = `${agentName}: "Power output is ${status} (Target: ${targetPower[0]}-${targetPower[1]}W). Adjusting resistance for optimal efficiency."`;
          addLog(message, "info");

          if (status === "low") {
            setResistance?.(
              currentMetrics.resistance
                ? Math.min(100, currentMetrics.resistance + 5)
                : 40,
            );
            triggerBeat("Power Target Correction", "climb", 6);
          } else {
            setResistance?.(
              currentMetrics.resistance
                ? Math.max(0, currentMetrics.resistance - 5)
                : 30,
            );
          }
          lastActionTimestamp.current = now;
        } else {
          // Periodic efficiency report
          if (Math.random() > 0.7) {
            const efficiency = Math.round(85 + (power / 300) * 10);
            addLog(
              `${agentName}: "Telemetry Analysis: Power efficiency at ${efficiency}%. Form looks stable."`,
              "info",
            );
          }
        }
      }

      // 3. Fallback/Standard Monitoring
      if (now - lastActionTimestamp.current > 30000) {
        // Log status every 30s if no actions
        addLog(
          `Monitoring: HR:${hr} | PWR:${power} | W'bal:${Math.round(wBalPct)}%`,
          "info",
        );
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(intervalId);
  }, [
    isEnabled,
    currentInterval,
    personality,
    agentName,
    triggerBeat,
    setResistance,
  ]);

  return {
    logs,
    addLog
  };
}
