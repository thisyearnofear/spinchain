"use client";

import { useState, useEffect } from "react";
import { useSuiTelemetry } from "./use-sui-telemetry";

type AgentPersonality = "zen" | "drill-sergeant" | "data";

type AgentLog = {
    timestamp: number;
    message: string;
    type: "info" | "action" | "alert";
};

export function useAiInstructor(
    agentName: string,
    personality: AgentPersonality,
    sessionObjectId: string | null
) {
    const [logs, setLogs] = useState<AgentLog[]>([]);
    const { triggerBeat } = useSuiTelemetry(null); // We only need triggerBeat, no stats object needed for agent
    const [isActive, setIsActive] = useState(false);

    const addLog = (message: string, type: AgentLog["type"] = "info") => {
        setLogs((prev) => [
            { timestamp: Date.now(), message, type },
            ...prev.slice(0, 19), // Keep last 20 logs
        ]);
    };

    // Agent decision loop
    useEffect(() => {
        if (!isActive || !sessionObjectId) return;

        const interval = setInterval(() => {
            // Mock dynamic input: Average HR of the "group"
            const avgHr = 130 + Math.random() * 40;

            // Logic based on personality
            if (personality === "drill-sergeant" && avgHr < 145) {
                const message = `${agentName}: "I see you slacking! SPRINT NOW!"`;
                addLog(message, "action");
                triggerBeat(sessionObjectId, "Attack the Hill!", "sprint", 9);
            } else if (personality === "zen" && avgHr > 165) {
                const message = `${agentName}: "Your heart is racing. Breathe. Find your center."`;
                addLog(message, "action");
                triggerBeat(sessionObjectId, "Deep Breath Recovery", "rest", 3);
            } else if (personality === "data") {
                const message = `Analyzing telemetry... Current group power efficiency at ${Math.round(85 + Math.random() * 10)}%.`;
                addLog(message, "info");
                // Maybe trigger a technical climb
                if (Math.random() > 0.8) {
                    triggerBeat(sessionObjectId, "Optimized Threshold Climb", "climb", 7);
                }
            } else {
                addLog(`Monitoring ride... Current Group HR: ${Math.round(avgHr)} BPM`, "info");
            }
        }, 8000); // Check every 8 seconds

        return () => clearInterval(interval);
    }, [isActive, sessionObjectId, personality, agentName, triggerBeat]);

    return {
        logs,
        isActive,
        setIsActive,
        addLog
    };
}
