/**
 * Next.js API Route for AI Narrative Generation
 * Venice AI (privacy-first, default) → Gemini fallback
 */

import { NextRequest, NextResponse } from "next/server";
import { generateNarrativeWithGemini } from "@/app/lib/gemini-client";
import { generateNarrativeWithVenice } from "@/app/lib/venice-client";

export const runtime = "edge";

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
    const body = (await req.json()) as NarrativeRequest;
    const { elevationProfile, theme, duration, routeName } = body;

    // Validate required fields
    if (!elevationProfile || !Array.isArray(elevationProfile) || elevationProfile.length < 2) {
      return NextResponse.json(
        { error: "Invalid request", message: "elevationProfile must be an array with at least 2 points" },
        { status: 400 }
      );
    }

    if (!theme || theme.trim().length < 2) {
      return NextResponse.json(
        { error: "Invalid request", message: "theme is required" },
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
    
    return NextResponse.json(
      { 
        error: "Generation failed",
        message: "Failed to generate narrative. Please try again.",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
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
