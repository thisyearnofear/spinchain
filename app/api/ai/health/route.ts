/**
 * AI Health Check Endpoint
 * Returns status of all AI providers
 * 
 * Used by UI to show available providers and for diagnostics
 */

import { NextResponse } from "next/server";
import { getUserAIPreferences } from "@/app/lib/ai-providers";

export const runtime = "edge";

export async function GET() {
  // Check environment variables
  const veniceAvailable = !!process.env.VENICE_API_KEY;
  const geminiEnvAvailable = !!process.env.GEMINI_API_KEY;
  
  // Get user preferences (for BYOK status)
  let userGeminiKey = false;
  try {
    const prefs = getUserAIPreferences();
    userGeminiKey = !!prefs.geminiApiKey;
  } catch {
    // localStorage not available (server-side)
  }

  // Determine preferred provider
  let preferredProvider: "venice" | "gemini" = "venice";
  try {
    const prefs = getUserAIPreferences();
    preferredProvider = prefs.preferredProvider === "gemini" ? "gemini" : "venice";
  } catch {
    // Use default
  }

  return NextResponse.json({
    status: veniceAvailable || geminiEnvAvailable || userGeminiKey ? "ready" : "not_configured",
    timestamp: new Date().toISOString(),
    providers: {
      venice: {
        available: veniceAvailable,
        configured: veniceAvailable,
        isDefault: true,
        model: "llama-3.3-70b",
        features: ["route_generation", "narrative", "chat", "coaching", "agent_reasoning"],
      },
      gemini: {
        available: geminiEnvAvailable || userGeminiKey,
        configured: geminiEnvAvailable,
        byokAvailable: userGeminiKey,
        isDefault: false,
        model: "gemini-3.0-flash-preview",
        features: [
          "route_generation",
          "narrative",
          "chat",
          "coaching",
          "agent_reasoning",
          "streaming",
          "structured_output",
          "multimodal",
        ],
      },
    },
    preferredProvider,
    version: "1.0.0",
  });
}
