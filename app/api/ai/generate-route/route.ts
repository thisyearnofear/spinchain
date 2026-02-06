/**
 * Next.js API Route for AI Route Generation
 * Powered by Gemini 3.0 Flash Preview
 * 
 * HACKATHON ENHANCEMENT:
 * - Streaming support for real-time generation
 * - Enhanced structured output with exercise zones
 * - No mock fallbacks - pure Gemini 3 power
 * - Robust error handling with retries
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  generateRouteWithGemini, 
  generateRouteStream,
  RouteRequest,
  RouteResponse 
} from "@/app/lib/gemini-client";

export const runtime = "edge";
export const maxDuration = 30; // Allow up to 30s for generation

type RouteGenerationRequest = {
  prompt: string;
  preferences?: string;
  duration?: number;
  difficulty?: "easy" | "moderate" | "hard" | "extreme";
  theme?: string;
  fitnessLevel?: "beginner" | "intermediate" | "advanced" | "elite";
  stream?: boolean;
};

/**
 * POST /api/ai/generate-route
 * Generate immersive cycling routes using Gemini 3
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RouteGenerationRequest;
    const { 
      prompt, 
      preferences, 
      duration, 
      difficulty,
      theme,
      fitnessLevel,
      stream = false 
    } = body;

    // Validate required fields
    if (!prompt || prompt.trim().length < 3) {
      return NextResponse.json(
        { 
          error: "Invalid request", 
          message: "Route description must be at least 3 characters" 
        },
        { status: 400 }
      );
    }

    // Validate API key
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { 
          error: "Configuration error", 
          message: "GEMINI_API_KEY not configured" 
        },
        { status: 503 }
      );
    }

    // Prepare request
    const routeRequest: RouteRequest = {
      prompt: prompt.trim(),
      duration: Math.min(Math.max(duration || 45, 15), 120), // Clamp 15-120 mins
      difficulty: difficulty || "moderate",
      preferences: preferences?.trim(),
      theme: theme as any,
      fitnessLevel: fitnessLevel || "intermediate",
    };

    // Handle streaming response
    if (stream) {
      const encoder = new TextEncoder();
      const stream_generator = generateRouteStream(routeRequest);

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream_generator) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
              );
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Standard response
    console.log(`[Gemini 3] Generating route: "${prompt.substring(0, 50)}..."`);
    const startTime = Date.now();
    
    const route = await generateRouteWithGemini(routeRequest);
    
    const duration_ms = Date.now() - startTime;
    console.log(`[Gemini 3] Route generated in ${duration_ms}ms: "${route.name}"`);

    // Add metadata
    const response: RouteResponse & { 
      _meta: { 
        generatedAt: string; 
        duration: number;
        model: string;
        version: string;
      } 
    } = {
      ...route,
      _meta: {
        generatedAt: new Date().toISOString(),
        duration: duration_ms,
        model: "gemini-3.0-flash-preview",
        version: "1.0.0",
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("[Gemini 3] Route generation error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Determine if it's a rate limit or API error
    const isRateLimit = errorMessage.toLowerCase().includes("rate") || 
                        errorMessage.toLowerCase().includes("quota");
    
    return NextResponse.json(
      { 
        error: isRateLimit ? "Rate limit exceeded" : "Generation failed",
        message: isRateLimit 
          ? "Please try again in a moment" 
          : "Failed to generate route. Please try again.",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}

/**
 * GET /api/ai/generate-route
 * Health check endpoint
 */
export async function GET() {
  const hasApiKey = !!process.env.GEMINI_API_KEY;
  
  return NextResponse.json({
    status: hasApiKey ? "ready" : "not_configured",
    model: "gemini-3.0-flash-preview",
    features: [
      "natural_language_route_generation",
      "exercise_zone_structuring",
      "story_beat_identification",
      "elevation_profiling",
      "streaming_support",
    ],
    version: "1.0.0",
  });
}
