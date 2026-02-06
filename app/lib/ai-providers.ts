/**
 * Multi-Provider AI Architecture
 * 
 * HACKATHON STRATEGY:
 * - Default: Venice AI (user has credits available)
 * - Optional: Gemini 3 (BYOK - Bring Your Own Key for hackathon showcase)
 * - Smart fallbacks with graceful degradation
 * - Clear UI indicators for which provider is active
 */

// Provider Types
export type AIProvider = "venice" | "gemini" | "auto";

export interface ProviderConfig {
  id: AIProvider;
  name: string;
  description: string;
  requiresApiKey: boolean;
  apiKeyEnvVar: string;
  capabilities: string[];
  isDefault: boolean;
  hackathonShowcase: boolean; // For highlighting to judges
}

// Provider Definitions
export const PROVIDERS: Record<AIProvider, ProviderConfig> = {
  venice: {
    id: "venice",
    name: "Venice AI",
    description: "Privacy-first inference with competitive pricing",
    requiresApiKey: true,
    apiKeyEnvVar: "VENICE_API_KEY",
    capabilities: [
      "route_generation",
      "narrative_creation",
      "chat",
      "agent_reasoning",
    ],
    isDefault: true,
    hackathonShowcase: false,
  },
  gemini: {
    id: "gemini",
    name: "Gemini 3.0 Flash",
    description: "Google's latest model - enhanced reasoning & structured outputs",
    requiresApiKey: true,
    apiKeyEnvVar: "GEMINI_API_KEY",
    capabilities: [
      "route_generation",
      "narrative_creation",
      "chat",
      "agent_reasoning",
      "streaming",
      "structured_output",
      "multimodal",
    ],
    isDefault: false,
    hackathonShowcase: true, // ⭐ Highlight this for judges
  },
  auto: {
    id: "auto",
    name: "Auto-Select",
    description: "Automatically choose best available provider",
    requiresApiKey: false,
    apiKeyEnvVar: "",
    capabilities: [],
    isDefault: false,
    hackathonShowcase: false,
  },
};

// User preferences storage key
export const AI_PREFERENCES_KEY = "spinchain-ai-preferences";

export interface UserAIPreferences {
  preferredProvider: AIProvider;
  geminiApiKey?: string; // BYOK - stored in localStorage (user's own key)
  enableStreaming: boolean;
  enableAdvancedFeatures: boolean; // Gemini 3 exclusive features
}

// Default preferences
export const DEFAULT_AI_PREFERENCES: UserAIPreferences = {
  preferredProvider: "venice", // Default to Venice (user has credits)
  enableStreaming: false, // Venice doesn't support streaming yet
  enableAdvancedFeatures: false,
};

// Client-side storage functions
export function getUserAIPreferences(): UserAIPreferences {
  if (typeof window === "undefined") return DEFAULT_AI_PREFERENCES;
  
  try {
    const stored = localStorage.getItem(AI_PREFERENCES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_AI_PREFERENCES, ...parsed };
    }
  } catch {
    // Fall back to defaults
  }
  
  return DEFAULT_AI_PREFERENCES;
}

export function setUserAIPreferences(prefs: Partial<UserAIPreferences>): void {
  if (typeof window === "undefined") return;
  
  const current = getUserAIPreferences();
  const updated = { ...current, ...prefs };
  localStorage.setItem(AI_PREFERENCES_KEY, JSON.stringify(updated));
}

export function clearUserAIPreferences(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AI_PREFERENCES_KEY);
}

// Determine which provider to use based on preferences and availability
export function resolveProvider(
  requestedProvider: AIProvider,
  serverEnv: { veniceAvailable: boolean; geminiAvailable: boolean }
): { provider: Exclude<AIProvider, "auto">; source: "user" | "server" | "fallback" } {
  // If user specifically requested a provider, try to use it
  if (requestedProvider !== "auto") {
    const config = PROVIDERS[requestedProvider];
    
    // Check if the requested provider is available
    if (requestedProvider === "venice" && serverEnv.veniceAvailable) {
      return { provider: "venice", source: "user" };
    }
    
    if (requestedProvider === "gemini" && serverEnv.geminiAvailable) {
      return { provider: "gemini", source: "user" };
    }
    
    // Requested provider not available, fall through to auto-selection
  }
  
  // Auto-select: prefer Venice (default), fall back to Gemini if available
  if (serverEnv.veniceAvailable) {
    return { provider: "venice", source: "fallback" };
  }
  
  if (serverEnv.geminiAvailable) {
    return { provider: "gemini", source: "fallback" };
  }
  
  // No providers available
  throw new Error("No AI providers available. Please configure VENICE_API_KEY or GEMINI_API_KEY.");
}

// Feature availability check
export function isFeatureAvailable(
  feature: string,
  provider: AIProvider
): boolean {
  if (provider === "auto") return true; // Will be resolved at runtime
  return PROVIDERS[provider].capabilities.includes(feature);
}

// Get provider badge/label for UI
export function getProviderBadge(provider: AIProvider): {
  label: string;
  color: string;
  icon: string;
  description: string;
} {
  switch (provider) {
    case "gemini":
      return {
        label: "Gemini 3",
        color: "bg-blue-500",
        icon: "✨",
        description: "Enhanced reasoning & structured outputs",
      };
    case "venice":
      return {
        label: "Venice AI",
        color: "bg-purple-500",
        icon: "🔒",
        description: "Privacy-first inference",
      };
    default:
      return {
        label: "Auto",
        color: "bg-gray-500",
        icon: "⚡",
        description: "Best available provider",
      };
  }
}
