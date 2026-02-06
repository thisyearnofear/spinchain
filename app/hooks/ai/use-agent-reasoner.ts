import { useState, useCallback } from "react";
import { getAIService, type AgentDecision, type AgentReasoningParams } from "@/app/lib/ai-service";

type ReasoningState = "idle" | "thinking" | "acting" | "error";

interface UseAgentReasonerProps {
  agentName: string;
  personality: string;
  enabled?: boolean;
}

export function useAgentReasoner({
  agentName,
  personality,
  enabled = true,
}: UseAgentReasonerProps) {
  const [state, setState] = useState<ReasoningState>("idle");
  const [lastDecision, setLastDecision] = useState<AgentDecision | null>(null);
  const [thoughtLog, setThoughtLog] = useState<string[]>([]);

  const reason = useCallback(
    async (context: AgentReasoningParams["context"]) => {
      if (!enabled) return;

      setState("thinking");
      try {
        const aiService = getAIService({ preferredProvider: "gemini" });
        const decision = await aiService.agentReasoning(
          agentName,
          personality,
          context
        );

        setLastDecision(decision);
        setThoughtLog((prev) =>
          [decision.thoughtProcess, ...prev].slice(0, 10),
        );
        setState("acting");

        // Reset back to idle after "actuation"
        setTimeout(() => setState("idle"), 2000);
      } catch (error) {
        console.error("Agent failed to reason:", error);
        setState("error");
      }
    },
    [agentName, personality, enabled],
  );

  return {
    state,
    lastDecision,
    thoughtLog,
    reason,
  };
}
