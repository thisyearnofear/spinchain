/**
 * Next.js API Route for AI Narrative Generation
 * Venice AI (privacy-first, default) → Gemini fallback
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/app/lib/api/response";
import { TtlCache } from "@/app/lib/api/cache";
import { checkRateLimit } from "@/app/lib/api/rate-limiter";
import { generateNarrativeWithGemini } from "@/app/lib/gemini-client";
import { generateNarrativeWithVenice } from "@/app/lib/venice-client";

const narrativeCache = new TtlCache<{ narrative: string; atmosphere: string; intensity: string; _provider: string }>(300_000);

export const runtime = "edge";
export const dynamic = 'force-dynamic';

type NarrativeRequest = {
  elevationProfile: number[];
  theme: string;
  duration: number;
  routeName?: string;
};

/**
 * POST /api/ai/generate-narrative
 * Generate immersive route narratives using Gemini 3
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return apiError("Rate limit exceeded. Please try again later.", "RATE_LIMITED", 429);
    }

    const body = (await req.json()) as NarrativeRequest;
    const { elevationProfile, theme, duration, routeName } = body;

    // Validate required fields
    if (!elevationProfile || !Array.isArray(elevationProfile) || elevationProfile.length < 2) {
      return apiError("elevationProfile must be an array with at least 2 points", "VALIDATION_FAILED", 400);
    }

    if (!theme || theme.trim().length < 2) {
      return apiError("theme is required", "MISSING_FIELD", 400);
    }

    const VENICE_API_KEY = process.env.VENICE_API_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!VENICE_API_KEY && !GEMINI_API_KEY) {
      return apiError("No AI provider configured. Set VENICE_API_KEY or GEMINI_API_KEY.", "NOT_CONFIGURED", 503);
    }

    const cacheKey = `${theme}:${duration}:${routeName ?? ""}:${elevationProfile.join(",")}`;
    const cached = narrativeCache.get(cacheKey);
    if (cached) {
      return NextResponse.json({
        ...cached,
        _meta: { generatedAt: new Date().toISOString(), duration: 0, model: cached._provider === "venice" ? "llama-3.3-70b" : "gemini-3.0-flash-preview", provider: cached._provider, inputStats: { elevationPoints: elevationProfile.length, elevationGain: Math.max(...elevationProfile) - Math.min(...elevationProfile), theme, duration }, cached: true },
      });
    }

    const startTime = Date.now();
    let result: { narrative: string; atmosphere: string; intensity: string };
    let providerUsed = "venice";

    if (VENICE_API_KEY) {
      console.log(`[Venice] Generating narrative for "${theme}" theme, ${duration}min route`);
      try {
        result = await generateNarrativeWithVenice(elevationProfile, theme, duration, routeName);
      } catch (veniceErr) {
        console.warn("[Venice] Narrative failed, falling back to Gemini:", veniceErr);
        if (!GEMINI_API_KEY) throw veniceErr;
        result = await generateNarrativeWithGemini(elevationProfile, theme, duration, routeName);
        providerUsed = "gemini";
      }
    } else {
      console.log(`[Gemini] Generating narrative for "${theme}" theme, ${duration}min route`);
      result = await generateNarrativeWithGemini(elevationProfile, theme, duration, routeName);
      providerUsed = "gemini";
    }

    const duration_ms = Date.now() - startTime;
    console.log(`[${providerUsed}] Narrative generated in ${duration_ms}ms`);

    narrativeCache.set(cacheKey, { ...result, _provider: providerUsed });

    return NextResponse.json({
      ...result,
      _meta: {
        generatedAt: new Date().toISOString(),
        duration: duration_ms,
        model: providerUsed === "venice" ? "llama-3.3-70b" : "gemini-3.0-flash-preview",
        provider: providerUsed,
        inputStats: {
          elevationPoints: elevationProfile.length,
          elevationGain: Math.max(...elevationProfile) - Math.min(...elevationProfile),
          theme,
          duration,
        },
      },
    });

  } catch (error) {
    console.error("[Gemini 3] Narrative generation error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return apiError("Failed to generate narrative. Please try again.", "INTERNAL_ERROR", 500, errorMessage);
  }
}

/**
 * GET /api/ai/generate-narrative
 * Health check
 */
export async function GET() {
  const hasApiKey = !!process.env.VENICE_API_KEY || !!process.env.GEMINI_API_KEY;
  
  return NextResponse.json({
    status: hasApiKey ? "ready" : "not_configured",
    provider: process.env.VENICE_API_KEY ? "venice" : "gemini",
    model: process.env.VENICE_API_KEY ? "llama-3.3-70b" : "gemini-3.0-flash-preview",
    features: [
      "multidimensional_narrative",
      "context_aware_descriptions",
      "structured_output",
      "theme_adaptation",
    ],
    version: "1.0.0",
  });
}
