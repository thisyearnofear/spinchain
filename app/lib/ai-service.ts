/**
 * Unified Multi-Provider AI Service Layer
 * 
 * HACKATHON STRATEGY:
 * - Default: Venice AI (you have credits)
 * - Optional: Gemini 3 (BYOK for judges to see)
 * - Smart fallbacks with graceful degradation
 * 
 * Features:
 * - Provider-agnostic interface
 * - Automatic fallback handling
 * - User preference management
 * - Clear provider indicators
 */

import {
  generateRouteWithGemini,
  generateNarrativeWithGemini,
  chatWithGemini,
  getCoachingWithGemini,
  agentReasoningWithGemini,
  generateRouteStream,
  RouteRequest,
  RouteResponse,
  CoachingContext,
  CoachingResponse,
  AgentDecision,
} from "./gemini-client";

import {
  generateRouteWithVenice,
  generateNarrativeWithVenice,
  chatWithVenice,
  getCoachingWithVenice,
  agentReasoningWithVenice,
} from "./venice-client";

import {
  AIProvider,
  getUserAIPreferences,
  setUserAIPreferences,
  getProviderBadge,
  isFeatureAvailable,
  DEFAULT_AI_PREFERENCES,
} from "./ai-providers";

// Re-export types
export type { AIProvider, RouteRequest, RouteResponse, CoachingContext, CoachingResponse, AgentDecision };
export { getProviderBadge, isFeatureAvailable, DEFAULT_AI_PREFERENCES };

// Internal types for streaming
type StreamStatus = { stage: string; message: string };
type StreamData = { type: "status" | "partial" | "complete"; data: StreamStatus | RouteResponse };

// Type aliases for backward compatibility
export type RouteGenerationParams = RouteRequest;
export type GeneratedRoute = RouteResponse & { _meta?: { provider: string; duration: number } };

// Agent reasoning parameter type
export interface AgentReasoningParams {
  agentName: string;
  personality: string;
  context: {
    telemetry: { avgBpm: number; resistance: number; duration: number };
    market: { ticketsSold: number; revenue: number; capacity: number };
    recentDecisions: string[];
  };
}

// Service configuration
export interface AIServiceConfig {
  preferredProvider?: AIProvider;
  geminiApiKey?: string; // BYOK
  enableStreaming?: boolean;
  enableAdvancedFeatures?: boolean;
}

/**
 * Unified AI Service - Multi-Provider Architecture
 * 
 * Usage:
 * ```typescript
 * const ai = new AIService(); // Uses Venice by default
 * 
 * // Or specify provider
 * const aiGemini = new AIService({ preferredProvider: 'gemini' });
 * 
 * // Route generation (works with any provider)
 * const route = await ai.generateRoute({
 *   prompt: "coastal sunset climb",
 *   duration: 45,
 *   difficulty: "moderate"
 * });
 * ```
 */
export class AIService {
  private config: AIServiceConfig;
  private baseUrl: string;

  constructor(config: AIServiceConfig = {}) {
    // Load from localStorage if not provided
    const prefs = getUserAIPreferences();
    this.config = {
      preferredProvider: config.preferredProvider || prefs.preferredProvider,
      geminiApiKey: config.geminiApiKey || prefs.geminiApiKey,
      enableStreaming: config.enableStreaming ?? prefs.enableStreaming,
      enableAdvancedFeatures: config.enableAdvancedFeatures ?? prefs.enableAdvancedFeatures,
    };
    this.baseUrl = "/api/ai";
  }

  /**
   * Get current active provider
   */
  getProvider(): AIProvider {
    return this.config.preferredProvider || "venice";
  }

  /**
   * Check if a feature is available with current provider
   */
  isFeatureAvailable(feature: string): boolean {
    return isFeatureAvailable(feature, this.getProvider());
  }

  /**
   * Get provider badge info for UI
   */
  getProviderBadge() {
    return getProviderBadge(this.getProvider());
  }

  /**
   * Generate a route from natural language description
   * Works with Venice or Gemini 3
   */
  async generateRoute(params: RouteRequest): Promise<RouteResponse & { _meta?: { provider: string; duration: number } }> {
    const provider = this.getProvider();
    const startTime = Date.now();

    try {
      let route: RouteResponse;

      if (provider === "gemini") {
        // Use server-side Gemini with BYOK or env key
        route = await this.callServerRoute("generate-route", params);
      } else {
        // Use Venice via server (for API key security)
        route = await this.callServerRoute("generate-route", { ...params, provider });
      }

      return {
        ...route,
        _meta: {
          provider,
          duration: Date.now() - startTime,
        },
      };
    } catch (error) {
      console.error(`[AIService] Route generation failed with ${provider}:`, error);
      
      // Try fallback if Gemini failed
      if (provider === "gemini" && this.config.preferredProvider !== "venice") {
        console.log("[AIService] Falling back to Venice AI...");
        const fallbackRoute = await this.callServerRoute("generate-route", {
          ...params,
          provider: "venice",
        });
        return {
          ...fallbackRoute,
          _meta: {
            provider: "venice (fallback)",
            duration: Date.now() - startTime,
          },
        };
      }
      
      throw error;
    }
  }

  /**
   * Stream route generation (Gemini 3 only)
   */
  async *streamRoute(params: RouteRequest): AsyncGenerator<StreamData> {
    const provider = this.getProvider();
    
    if (provider !== "gemini") {
      // Venice doesn't support streaming, yield status then complete
      yield { type: "status", data: { stage: "generating", message: "Generating route..." } };
      const route = await this.generateRoute(params);
      yield { type: "complete", data: route };
      return;
    }

    // Gemini streaming via server
    const response = await fetch(`${this.baseUrl}/generate-route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, stream: true }),
    });

    if (!response.ok) {
      throw new Error("Stream failed");
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n\n");
      
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            yield data;
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  /**
   * Generate narrative description for a route
   */
  async generateNarrative(
    elevationProfile: number[],
    theme: string,
    duration: number,
    routeName?: string
  ): Promise<{ narrative: string; atmosphere: string; intensity: string; _meta?: { provider: string } }> {
    const provider = this.getProvider();
    
    const result = await this.callServerRoute("generate-narrative", {
      elevationProfile,
      theme,
      duration,
      routeName,
      provider,
    });

    return {
      ...result,
      _meta: { provider },
    };
  }

  /**
   * Chat with AI coach
   */
  async chat(messages: Array<{ role: string; content: string }>): Promise<{ response: string; _meta?: { provider: string } }> {
    const provider = this.getProvider();
    
    const result = await this.callServerRoute("chat", {
      messages,
      provider,
    });

    return {
      ...result,
      _meta: { provider },
    };
  }

  /**
   * Get adaptive coaching based on rider context
   */
  async getCoaching(
    context: CoachingContext,
    conversationHistory: Array<{ role: "rider" | "coach"; message: string }> = []
  ): Promise<CoachingResponse & { _meta?: { provider: string } }> {
    const provider = this.getProvider();
    
    const result = await this.callServerRoute("chat", {
      mode: "coaching",
      context,
      conversationHistory,
      provider,
    });

    return {
      ...result,
      _meta: { provider },
    };
  }

  /**
   * Agent reasoning for autonomous decisions
   */
  async agentReasoning(
    agentName: string,
    personality: string,
    context: {
      telemetry: { avgBpm: number; resistance: number; duration: number };
      market: { ticketsSold: number; revenue: number; capacity: number };
      recentDecisions: string[];
    }
  ): Promise<AgentDecision & { _meta?: { provider: string } }> {
    const provider = this.getProvider();
    
    const result = await this.callServerRoute("agent-reasoning", {
      agentName,
      personality,
      context,
      provider,
    });

    return {
      ...result,
      _meta: { provider },
    };
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<AIServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Persist to localStorage
    setUserAIPreferences({
      preferredProvider: this.config.preferredProvider,
      geminiApiKey: this.config.geminiApiKey,
      enableStreaming: this.config.enableStreaming,
      enableAdvancedFeatures: this.config.enableAdvancedFeatures,
    });
  }

  /**
   * Switch provider
   */
  switchProvider(provider: AIProvider): void {
    this.updateConfig({ preferredProvider: provider });
  }

  /**
   * Internal: Call server API route
   */
  private async callServerRoute(endpoint: string, body: Record<string, unknown>): Promise<RouteResponse> {
    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        // Include BYOK if using Gemini
        ...(this.config.preferredProvider === "gemini" && this.config.geminiApiKey && {
          apiKey: this.config.geminiApiKey,
        }),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `${endpoint} failed`);
    }

    return response.json() as Promise<RouteResponse>;
  }
}

// Singleton instance for convenience
let defaultService: AIService | null = null;

export function getAIService(config?: AIServiceConfig): AIService {
  if (!defaultService || config) {
    defaultService = new AIService(config);
  }
  return defaultService;
}

// Utility to check provider availability on server
export async function checkProviderAvailability(): Promise<{
  venice: boolean;
  gemini: boolean;
  preferred: AIProvider;
}> {
  try {
    const response = await fetch("/api/ai/health");
    const data = await response.json();
    return {
      venice: data.providers.venice,
      gemini: data.providers.gemini,
      preferred: data.preferredProvider,
    };
  } catch {
    return { venice: false, gemini: false, preferred: "venice" };
  }
}
