/**
 * Unified AI Service Layer
 * Consolidates all AI interactions (Gemini) for instructor agents, route generation, and narrative prompts
 * 
 * Core Principles:
 * - Single source of truth for AI configuration
 * - Server-side API key management (via Next.js API routes)
 * - Shared error handling and rate limiting
 * - Type-safe function calling interface
 */

export type AIProvider = "gemini" | "openai";

export type FunctionDeclaration = {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
};

export type AIMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type RouteGenerationParams = {
  prompt: string;
  preferences?: string;
  duration?: number; // minutes
  difficulty?: "easy" | "moderate" | "hard";
};

export type GeneratedRoute = {
  name: string;
  description: string;
  coordinates: Array<{ lat: number; lng: number; ele?: number }>;
  estimatedDistance: number; // km
  estimatedDuration: number; // minutes
  elevationGain: number; // meters
  storyBeats: Array<{
    progress: number;
    label: string;
    type: "climb" | "sprint" | "drop" | "rest";
  }>;
};

/**
 * Client-side wrapper for AI service
 * All actual API calls go through Next.js API routes for security
 */
export class AIService {
  private provider: AIProvider;
  private baseUrl: string;

  constructor(provider: AIProvider = "gemini") {
    this.provider = provider;
    this.baseUrl = "/api/ai";
  }

  /**
   * Generate a route from natural language description
   */
  async generateRoute(params: RouteGenerationParams): Promise<GeneratedRoute> {
    const response = await fetch(`${this.baseUrl}/generate-route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, provider: this.provider }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to generate route");
    }

    return response.json();
  }

  /**
   * Generate narrative description for a route
   */
  async generateNarrative(
    elevationProfile: number[],
    theme: string,
    duration: number
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/generate-narrative`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        elevationProfile,
        theme,
        duration,
        provider: this.provider,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to generate narrative");
    }

    const data = await response.json();
    return data.narrative;
  }

  /**
   * Chat with AI for general queries
   */
  async chat(messages: AIMessage[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, provider: this.provider }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Chat failed");
    }

    const data = await response.json();
    return data.response;
  }

  /**
   * Stream chat responses for real-time interactions
   */
  async *streamChat(messages: AIMessage[]): AsyncGenerator<string> {
    const response = await fetch(`${this.baseUrl}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, provider: this.provider }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Stream chat failed");
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value);
    }
  }
}

// Singleton instance
let aiServiceInstance: AIService | null = null;

export function getAIService(provider?: AIProvider): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService(provider);
  }
  return aiServiceInstance;
}
