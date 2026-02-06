/**
 * Next.js API Route for AI Chat / Coaching
 * Powered by Gemini 3.0 Flash Preview
 * 
 * HACKATHON ENHANCEMENT:
 * - Real-time adaptive coaching with context awareness
 * - Structured JSON responses for actionable guidance
 * - Performance state analysis
 * - No mock fallbacks
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  getCoachingWithGemini,
  chatWithGemini,
  CoachingContext,
  CoachingResponse 
} from "@/app/lib/gemini-client";

export const runtime = "edge";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type CoachingRequest = {
  mode: "coaching" | "general";
  messages: ChatMessage[];
  context?: CoachingContext;
  conversationHistory?: Array<{ role: "rider" | "coach"; message: string }>;
};

/**
 * POST /api/ai/chat
 * Adaptive AI coaching powered by Gemini 3
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CoachingRequest;
    const { 
      mode = "general", 
      messages, 
      context,
      conversationHistory = []
    } = body;

    // Validate API key
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Configuration error", message: "GEMINI_API_KEY not configured" },
        { status: 503 }
      );
    }

    const startTime = Date.now();
    let response: CoachingResponse | { response: string };

    if (mode === "coaching" && context) {
      // Adaptive coaching mode with real-time context
      console.log(`[Gemini 3] Coaching: HR ${context.riderHeartRate} BPM, progress ${Math.round(context.workoutProgress * 100)}%`);
      
      response = await getCoachingWithGemini(context, conversationHistory);
      
    } else {
      // General chat mode
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || lastMessage.role !== "user") {
        return NextResponse.json(
          { error: "Invalid request", message: "Last message must be from user" },
          { status: 400 }
        );
      }

      console.log(`[Gemini 3] Chat: "${lastMessage.content.substring(0, 50)}..."`);
      
      const chatResponse = await chatWithGemini(messages);
      response = { response: chatResponse };
    }

    const duration_ms = Date.now() - startTime;
    console.log(`[Gemini 3] Response generated in ${duration_ms}ms`);

    return NextResponse.json({
      ...response,
      _meta: {
        generatedAt: new Date().toISOString(),
        duration: duration_ms,
        model: "gemini-3.0-flash-preview",
        mode,
      },
    });

  } catch (error) {
    console.error("[Gemini 3] Chat error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return NextResponse.json(
      { 
        error: "Chat failed",
        message: "Failed to generate response. Please try again.",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/chat
 * Health check
 */
export async function GET() {
  const hasApiKey = !!process.env.GEMINI_API_KEY;
  
  return NextResponse.json({
    status: hasApiKey ? "ready" : "not_configured",
    model: "gemini-3.0-flash-preview",
    modes: ["general", "coaching"],
    features: [
      "adaptive_coaching",
      "performance_analysis",
      "structured_responses",
      "context_awareness",
    ],
    version: "1.0.0",
  });
}
