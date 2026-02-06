/**
 * Next.js API Route for AI Narrative Generation
 * Powered by Gemini 3.0 Flash Preview
 * 
 * HACKATHON ENHANCEMENT:
 * - Multidimensional narrative generation (narrative + atmosphere + intensity)
 * - Context-aware descriptions based on elevation profile
 * - Structured output for UI components
 */

import { NextRequest, NextResponse } from "next/server";
import { generateNarrativeWithGemini } from "@/app/lib/gemini-client";

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

    // Validate API key
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Configuration error", message: "GEMINI_API_KEY not configured" },
        { status: 503 }
      );
    }

    console.log(`[Gemini 3] Generating narrative for "${theme}" theme, ${duration}min route`);
    
    const startTime = Date.now();
    
    const result = await generateNarrativeWithGemini(
      elevationProfile,
      theme,
      duration,
      routeName
    );
    
    const duration_ms = Date.now() - startTime;
    console.log(`[Gemini 3] Narrative generated in ${duration_ms}ms`);

    return NextResponse.json({
      ...result,
      _meta: {
        generatedAt: new Date().toISOString(),
        duration: duration_ms,
        model: "gemini-3.0-flash-preview",
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
  const hasApiKey = !!process.env.GEMINI_API_KEY;
  
  return NextResponse.json({
    status: hasApiKey ? "ready" : "not_configured",
    model: "gemini-3.0-flash-preview",
    features: [
      "multidimensional_narrative",
      "context_aware_descriptions",
      "structured_output",
      "theme_adaptation",
    ],
    version: "1.0.0",
  });
}
