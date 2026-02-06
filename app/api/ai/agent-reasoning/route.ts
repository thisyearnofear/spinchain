/**
 * Next.js API Route for Agent Reasoning
 * Powered by Gemini 3.0 Flash Preview
 * 
 * HACKATHON ENHANCEMENT:
 * - Structured reasoning with confidence scores
 * - Dual-objective optimization (performance + revenue)
 * - Explainable AI decisions
 * - Gemini 3 JSON mode for reliable output
 */

import { NextRequest, NextResponse } from "next/server";
import { agentReasoningWithGemini, AgentDecision } from "@/app/lib/gemini-client";

export const runtime = "edge";

type AgentReasoningRequest = {
  agentName: string;
  personality: string;
  context: {
    telemetry: {
      avgBpm: number;
      resistance: number;
      duration: number;
    };
    market: {
      ticketsSold: number;
      revenue: number;
      capacity: number;
    };
    recentDecisions: string[];
  };
};

/**
 * POST /api/ai/agent-reasoning
 * Autonomous agent decision-making powered by Gemini 3
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AgentReasoningRequest;
    const { agentName, personality, context } = body;

    // Validate required fields
    if (!agentName || !personality) {
      return NextResponse.json(
        { error: "Invalid request", message: "agentName and personality are required" },
        { status: 400 }
      );
    }

    // Validate API key
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Configuration error", message: "GEMINI_API_KEY not configured" },
        { status: 503 }
      );
    }

    console.log(`[Gemini 3] Agent reasoning: ${agentName} (${personality})`);
    console.log(`[Gemini 3] Context: ${context.market.ticketsSold}/${context.market.capacity} tickets, ${context.telemetry.avgBpm} BPM avg`);

    const startTime = Date.now();
    
    const decision = await agentReasoningWithGemini(agentName, personality, context);
    
    const duration_ms = Date.now() - startTime;
    console.log(`[Gemini 3] Decision in ${duration_ms}ms: ${decision.action} (${Math.round(decision.confidence * 100)}% confidence)`);

    return NextResponse.json({
      ...decision,
      _meta: {
        generatedAt: new Date().toISOString(),
        duration: duration_ms,
        model: "gemini-3.0-flash-preview",
        agent: agentName,
        personality,
      },
    });

  } catch (error) {
    console.error("[Gemini 3] Agent reasoning error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return NextResponse.json(
      { 
        error: "Reasoning failed",
        message: "Failed to generate agent decision. Please try again.",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/agent-reasoning
 * Health check and capabilities
 */
export async function GET() {
  const hasApiKey = !!process.env.GEMINI_API_KEY;
  
  return NextResponse.json({
    status: hasApiKey ? "ready" : "not_configured",
    model: "gemini-3.0-flash-preview",
    features: [
      "structured_reasoning",
      "confidence_scoring",
      "dual_objective_optimization",
      "explainable_decisions",
      "json_mode_output",
    ],
    capabilities: {
      actions: [
        "increase_resistance",
        "decrease_resistance", 
        "maintain",
        "surge_price",
        "discount_price",
        "wait",
      ],
      objectives: ["rider_performance", "revenue_optimization"],
    },
    version: "1.0.0",
  });
}
