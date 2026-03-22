export const dynamic = 'force-dynamic';
/**
 * Next.js API Route for AI Chat / Coaching
 * Venice AI (privacy-first, default) → Gemini fallback
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  getCoachingWithGemini,
  chatWithGemini,
  CoachingContext,
  CoachingResponse 
} from "@/app/lib/gemini-client";
import { getCoachingWithVenice, chatWithVenice } from "@/app/lib/venice-client";

export const runtime = "edge";

const VENICE_API_KEY = process.env.VENICE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Short-TTL response cache — avoids redundant Gemini calls for identical inputs
type CachedResponse = (CoachingResponse | { response: string }) & { _provider?: string };
const responseCache = new Map<string, { value: CachedResponse; expiresAt: number }>();
const CACHE_TTL_MS = 60_000; // 60 seconds

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

    if (!VENICE_API_KEY && !GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Configuration error", message: "No AI provider configured. Set VENICE_API_KEY or GEMINI_API_KEY." },
        { status: 503 }
      );
    }

    const startTime = Date.now();
    let response: CachedResponse;
    let providerUsed = "venice";

    // Check short-TTL cache for identical inputs
    const cacheKey = JSON.stringify({ mode, messages, context, conversationHistory });
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({
        ...cached.value,
        _meta: { generatedAt: new Date().toISOString(), duration: 0, model: cached.value._provider ?? "venice", mode, cached: true },
      });
    }

    if (mode === "coaching" && context) {
      if (VENICE_API_KEY) {
        console.log(`[Venice] Coaching: HR ${context.riderHeartRate} BPM, progress ${Math.round(context.workoutProgress * 100)}%`);
        try {
          response = await getCoachingWithVenice(context, conversationHistory);
        } catch (veniceErr) {
          console.warn("[Venice] Coaching failed, falling back to Gemini:", veniceErr);
          if (!GEMINI_API_KEY) throw veniceErr;
          response = await getCoachingWithGemini(context, conversationHistory);
          providerUsed = "gemini";
        }
      } else {
        console.log(`[Gemini] Coaching: HR ${context.riderHeartRate} BPM, progress ${Math.round(context.workoutProgress * 100)}%`);
        response = await getCoachingWithGemini(context, conversationHistory);
        providerUsed = "gemini";
      }
    } else {
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || lastMessage.role !== "user") {
        return NextResponse.json(
          { error: "Invalid request", message: "Last message must be from user" },
          { status: 400 }
        );
      }

      if (VENICE_API_KEY) {
        console.log(`[Venice] Chat: "${lastMessage.content.substring(0, 50)}..."`);
        try {
          const chatResponse = await chatWithVenice(messages);
          response = { response: chatResponse };
        } catch (veniceErr) {
          console.warn("[Venice] Chat failed, falling back to Gemini:", veniceErr);
          if (!GEMINI_API_KEY) throw veniceErr;
          const chatResponse = await chatWithGemini(messages);
          response = { response: chatResponse };
          providerUsed = "gemini";
        }
      } else {
        console.log(`[Gemini] Chat: "${lastMessage.content.substring(0, 50)}..."`);
        const chatResponse = await chatWithGemini(messages);
        response = { response: chatResponse };
        providerUsed = "gemini";
      }
    }

    const duration_ms = Date.now() - startTime;
    console.log(`[${providerUsed}] Response generated in ${duration_ms}ms`);

    // Store in short-TTL cache; evict stale entries to prevent unbounded growth
    responseCache.set(cacheKey, { value: { ...response, _provider: providerUsed }, expiresAt: Date.now() + CACHE_TTL_MS });
    for (const [k, v] of responseCache) {
      if (v.expiresAt <= Date.now()) responseCache.delete(k);
    }

    return NextResponse.json({
      ...response,
      _meta: {
        generatedAt: new Date().toISOString(),
        duration: duration_ms,
        model: providerUsed === "venice" ? "llama-3.3-70b" : "gemini-3.0-flash-preview",
        provider: providerUsed,
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
  const hasApiKey = !!VENICE_API_KEY || !!GEMINI_API_KEY;
  
  return NextResponse.json({
    status: hasApiKey ? "ready" : "not_configured",
    provider: VENICE_API_KEY ? "venice" : "gemini",
    model: VENICE_API_KEY ? "llama-3.3-70b" : "gemini-3.0-flash-preview",
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
