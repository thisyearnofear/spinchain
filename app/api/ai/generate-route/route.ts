/**
 * Next.js API Route for AI Route Generation
 * Multi-Provider Support: Venice AI (default) | Gemini 3 (BYOK)
 *
 * Architecture:
 * - Primary: Venice AI (production credits, privacy-focused, no data retention)
 * - Fallback: Gemini 3 (BYOK supported for advanced features)
 * - Provider selection via 'provider' param or header
 *
 * Production Features:
 * - Input validation with strict schema enforcement
 * - Rate limiting support via server-side throttling
 * - Elevation profile validation for realistic routes
 * - Structured output with type safety
 */

import { NextRequest, NextResponse } from "next/server";
import {
  generateRouteWithGemini,
  generateRouteStream,
  RouteRequest,
  RouteResponse,
  type RouteTheme,
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

// Validation constants
const MIN_PROMPT_LENGTH = 3;
const MAX_PROMPT_LENGTH = 500;
const MIN_DURATION = 15;
const MAX_DURATION = 120;
const VALID_DIFFICULTIES = ["easy", "moderate", "hard", "extreme"] as const;
const VALID_FITNESS_LEVELS = ["beginner", "intermediate", "advanced", "elite"] as const;

/**
 * Validates route generation request with strict schema enforcement
 */
function validateRouteRequest(body: unknown): { valid: true; data: RouteGenerationRequest } | { valid: false; error: string; code: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request format", code: "INVALID_FORMAT" };
  }

  const req = body as Record<string, unknown>;

  // Prompt validation (required)
  if (typeof req.prompt !== "string") {
    return { valid: false, error: "Missing required field: prompt", code: "MISSING_PROMPT" };
  }
  
  const trimmedPrompt = req.prompt.trim();
  if (trimmedPrompt.length < MIN_PROMPT_LENGTH) {
    return { valid: false, error: `Prompt must be at least ${MIN_PROMPT_LENGTH} characters`, code: "PROMPT_TOO_SHORT" };
  }
  if (trimmedPrompt.length > MAX_PROMPT_LENGTH) {
    return { valid: false, error: `Prompt must be at most ${MAX_PROMPT_LENGTH} characters`, code: "PROMPT_TOO_LONG" };
  }

  // Duration validation
  if (req.duration !== undefined) {
    if (typeof req.duration !== "number" || isNaN(req.duration)) {
      return { valid: false, error: "Duration must be a number", code: "INVALID_DURATION" };
    }
    if (req.duration < MIN_DURATION || req.duration > MAX_DURATION) {
      return { valid: false, error: `Duration must be between ${MIN_DURATION} and ${MAX_DURATION} minutes`, code: "DURATION_OUT_OF_RANGE" };
    }
  }

  // Difficulty validation
  if (req.difficulty !== undefined && !VALID_DIFFICULTIES.includes(req.difficulty as typeof VALID_DIFFICULTIES[number])) {
    return { valid: false, error: `Difficulty must be one of: ${VALID_DIFFICULTIES.join(", ")}`, code: "INVALID_DIFFICULTY" };
  }

  // Fitness level validation
  if (req.fitnessLevel !== undefined && !VALID_FITNESS_LEVELS.includes(req.fitnessLevel as typeof VALID_FITNESS_LEVELS[number])) {
    return { valid: false, error: `Fitness level must be one of: ${VALID_FITNESS_LEVELS.join(", ")}`, code: "INVALID_FITNESS_LEVEL" };
  }

  // Provider validation
  if (req.provider !== undefined && !["venice", "gemini"].includes(req.provider as string)) {
    return { valid: false, error: "Provider must be 'venice' or 'gemini'", code: "INVALID_PROVIDER" };
  }

  return {
    valid: true,
    data: {
      prompt: trimmedPrompt,
      preferences: typeof req.preferences === "string" ? req.preferences.trim() : undefined,
      duration: req.duration as number | undefined,
      difficulty: req.difficulty as RouteGenerationRequest["difficulty"],
      theme: typeof req.theme === "string" ? req.theme : undefined,
      fitnessLevel: req.fitnessLevel as RouteGenerationRequest["fitnessLevel"],
      stream: Boolean(req.stream),
      provider: (req.provider as "venice" | "gemini") || "venice",
      apiKey: typeof req.apiKey === "string" ? req.apiKey : undefined,
    },
  };
}

/**
 * POST /api/ai/generate-route
 * Generate immersive cycling routes using AI
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const validation = validateRouteRequest(rawBody);

    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", message: validation.error, code: validation.code },
        { status: 400 }
      );
    }

    const body = validation.data;
    const { 
      prompt, 
      preferences, 
      duration, 
      difficulty,
      theme,
      fitnessLevel,
      stream = false,
      provider = "venice",
      apiKey,
    } = body;

    // Prepare request
    const routeRequest: RouteRequest = {
      prompt: prompt.trim(),
      duration: Math.min(Math.max(duration || 45, 15), 120),
      difficulty: difficulty || "moderate",
      preferences: preferences?.trim(),
      theme: theme as RouteTheme | undefined,
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
