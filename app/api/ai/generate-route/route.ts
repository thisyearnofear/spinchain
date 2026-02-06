/**
 * Next.js API Route for AI Route Generation
 * Multi-Provider Support: Venice AI (default) | Gemini 3 (BYOK)
 * 
 * HACKATHON STRATEGY:
 * - Default to Venice AI (user has credits)
 * - Allow Gemini 3 via BYOK (for hackathon judges to see)
 * - Provider selection via 'provider' param or header
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  generateRouteWithGemini, 
  generateRouteStream,
  RouteRequest,
  RouteResponse 
} from "@/app/lib/gemini-client";
import { generateRouteWithVenice } from "@/app/lib/venice-client";

export const runtime = "edge";
export const maxDuration = 30;

type RouteGenerationRequest = {
  prompt: string;
  preferences?: string;
  duration?: number;
  difficulty?: "easy" | "moderate" | "hard" | "extreme";
  theme?: string;
  fitnessLevel?: "beginner" | "intermediate" | "advanced" | "elite";
  stream?: boolean;
  provider?: "venice" | "gemini";
  apiKey?: string; // BYOK for Gemini
};

/**
 * POST /api/ai/generate-route
 * Generate immersive cycling routes using AI
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
      stream = false,
      provider = "venice", // DEFAULT: Venice AI
      apiKey, // BYOK for Gemini
    } = body;

    // Validate required fields
    if (!prompt || prompt.trim().length < 3) {
      return NextResponse.json(
        { error: "Invalid request", message: "Route description must be at least 3 characters" },
        { status: 400 }
      );
    }

    // Prepare request
    const routeRequest: RouteRequest = {
      prompt: prompt.trim(),
      duration: Math.min(Math.max(duration || 45, 15), 120),
      difficulty: difficulty || "moderate",
      preferences: preferences?.trim(),
      theme: theme as any,
      fitnessLevel: fitnessLevel || "intermediate",
    };

    // Log provider selection
    console.log(`[AI Route] Provider: ${provider}, Prompt: "${prompt.substring(0, 40)}..."`);

    // Route to appropriate provider
    if (provider === "gemini") {
      return await handleGeminiRequest(routeRequest, stream, apiKey);
    } else {
      return await handleVeniceRequest(routeRequest);
    }

  } catch (error) {
    console.error("[AI Route] Generation error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const isConfigError = errorMessage.includes("API_KEY");
    
    return NextResponse.json(
      { 
        error: isConfigError ? "Configuration error" : "Generation failed",
        message: isConfigError 
          ? "AI provider not configured. Please check your API keys."
          : "Failed to generate route. Please try again.",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: isConfigError ? 503 : 500 }
    );
  }
}

/**
 * Handle Gemini 3 request (with BYOK support)
 */
async function handleGeminiRequest(
  request: RouteRequest, 
  stream: boolean,
  userApiKey?: string
) {
  // Check for API key (BYOK or env)
  const hasEnvKey = !!process.env.GEMINI_API_KEY;
  const hasUserKey = !!userApiKey;
  
  if (!hasEnvKey && !hasUserKey) {
    return NextResponse.json(
      { 
        error: "Gemini 3 not configured",
        message: "Please add your Gemini API key in settings (BYOK) or contact admin",
        provider: "gemini",
      },
      { status: 503 }
    );
  }

  // Use user's API key if provided (BYOK)
  if (hasUserKey) {
    // Temporarily set the key for this request
    process.env.GEMINI_API_KEY = userApiKey;
  }

  try {
    const startTime = Date.now();

    if (stream) {
      // Streaming response
      const encoder = new TextEncoder();
      const stream_generator = generateRouteStream(request);

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
    const route = await generateRouteWithGemini(request);
    
    return NextResponse.json({
      ...route,
      _meta: {
        generatedAt: new Date().toISOString(),
        duration: Date.now() - startTime,
        provider: "gemini",
        model: "gemini-3.0-flash-preview",
        byok: hasUserKey, // Flag if user provided their own key
      },
    });

  } finally {
    // Restore original env key if we used BYOK
    if (hasUserKey && hasEnvKey) {
      process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Keep as is
    }
  }
}

/**
 * Handle Venice AI request (default)
 */
async function handleVeniceRequest(request: RouteRequest) {
  const hasVeniceKey = !!process.env.VENICE_API_KEY;
  
  if (!hasVeniceKey) {
    // Try Gemini as fallback
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;
    if (hasGeminiKey) {
      console.log("[AI Route] Venice not configured, falling back to Gemini...");
      return await handleGeminiRequest(request, false, undefined);
    }
    
    return NextResponse.json(
      { 
        error: "No AI providers available",
        message: "Please configure VENICE_API_KEY or GEMINI_API_KEY",
      },
      { status: 503 }
    );
  }

  const startTime = Date.now();
  const route = await generateRouteWithVenice(request);
  
  return NextResponse.json({
    ...route,
    _meta: {
      generatedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      provider: "venice",
      model: "llama-3.3-70b",
    },
  });
}

/**
 * GET /api/ai/generate-route
 * Health check
 */
export async function GET() {
  const veniceAvailable = !!process.env.VENICE_API_KEY;
  const geminiAvailable = !!process.env.GEMINI_API_KEY;
  
  return NextResponse.json({
    status: veniceAvailable || geminiAvailable ? "ready" : "not_configured",
    providers: {
      venice: {
        available: veniceAvailable,
        default: true,
        model: "llama-3.3-70b",
      },
      gemini: {
        available: geminiAvailable,
        byok: true, // Supports Bring Your Own Key
        model: "gemini-3.0-flash-preview",
        features: ["streaming", "structured_output"],
      },
    },
  });
}
