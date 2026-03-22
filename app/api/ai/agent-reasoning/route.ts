/**
 * Next.js API Route for Agent Reasoning
 * Venice AI (privacy-first, default) → Gemini fallback
 */

import { NextRequest, NextResponse } from "next/server";
import { agentReasoningWithGemini, AgentDecision } from "@/app/lib/gemini-client";
import { agentReasoningWithVenice } from "@/app/lib/venice-client";

export const runtime = "edge";
export const dynamic = 'force-dynamic';

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

    const VENICE_API_KEY = process.env.VENICE_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!VENICE_API_KEY && !GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Configuration error", message: "No AI provider configured. Set VENICE_API_KEY or GEMINI_API_KEY." },
        { status: 503 }
      );
    }

    const startTime = Date.now();
    let decision: AgentDecision;
    let providerUsed = "venice";

    // Primary: Venice AI (Privacy-focused, default)
    // Fallback: Gemini 3
    if (VENICE_API_KEY) {
      console.log(`[Venice] Agent reasoning: ${agentName} (${personality})`);
      try {
        decision = await agentReasoningWithVenice(agentName, personality, context);
      } catch (veniceErr) {
        console.warn("[Venice] Agent reasoning failed, falling back to Gemini:", veniceErr);
        if (!GEMINI_API_KEY) throw veniceErr;
        decision = await agentReasoningWithGemini(agentName, personality, context);
        providerUsed = "gemini";
      }
    } else if (GEMINI_API_KEY) {
      console.log(`[Gemini] Agent reasoning: ${agentName} (${personality})`);
      decision = await agentReasoningWithGemini(agentName, personality, context);
      providerUsed = "gemini";
    } else {
      throw new Error("No AI providers available");
    }

    const duration_ms = Date.now() - startTime;
    console.log(`[${providerUsed}] Decision in ${duration_ms}ms: ${decision.action} (${Math.round(decision.confidence * 100)}% confidence)`);

    return NextResponse.json({
      ...decision,
      _meta: {
        generatedAt: new Date().toISOString(),
        duration: duration_ms,
        model: providerUsed === "venice" ? "llama-3.3-70b" : "gemini-3.0-flash-preview",
        provider: providerUsed,
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
  const hasApiKey = !!process.env.VENICE_API_KEY || !!process.env.GEMINI_API_KEY;
  
  return NextResponse.json({
    status: hasApiKey ? "ready" : "not_configured",
    provider: process.env.VENICE_API_KEY ? "venice" : "gemini",
    model: process.env.VENICE_API_KEY ? "llama-3.3-70b" : "gemini-3.0-flash-preview",
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
