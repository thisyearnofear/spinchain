/**
 * API Client - Centralized HTTP client with interceptors
 * 
 * Features:
 * - Request/Response interceptors
 * - Automatic retry with exponential backoff
 * - Request deduplication
 * - Error normalization
 * - Type-safe responses
 */

import { getUserAIPreferences } from "./ai-providers";

// API Configuration
const API_CONFIG = {
  baseURL: "/api",
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
};

// Request/Response types
interface RequestConfig extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  skipCache?: boolean;
}

interface APIError extends Error {
  status: number;
  code: string;
  data?: unknown;
}

// In-flight request deduplication
const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Generate cache key for request deduplication
 */
function getCacheKey(url: string, options: RequestInit): string {
  return `${options.method || "GET"}:${url}:${JSON.stringify(options.body)}`;
}

/**
 * Sleep utility for retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalize API errors
 */
function normalizeError(response: Response, data: unknown): APIError {
  const error = new Error() as APIError;
  error.name = "APIError";
  error.status = response.status;
  error.code = (data as { code?: string })?.code || `HTTP_${response.status}`;
  error.message = (data as { message?: string })?.message || `Request failed with status ${response.status}`;
  error.data = data;
  return error;
}

/**
 * Request interceptor - adds auth headers, timestamps, etc.
 */
async function requestInterceptor(
  url: string,
  options: RequestInit
): Promise<{ url: string; options: RequestInit }> {
  const headers = new Headers(options.headers);
  
  // Add default headers
  headers.set("Content-Type", "application/json");
  headers.set("X-Request-ID", `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  
  // Add AI provider preferences if relevant
  if (url.includes("/ai/")) {
    const prefs = getUserAIPreferences();
    if (prefs.preferredProvider) {
      headers.set("X-AI-Provider", prefs.preferredProvider);
    }
    if (prefs.geminiApiKey) {
      headers.set("X-Gemini-Key", "present"); // Don't send actual key, just indicator
    }
  }
  
  return {
    url,
    options: {
      ...options,
      headers,
    },
  };
}

/**
 * Response interceptor - handles common response patterns
 */
async function responseInterceptor<T>(response: Response): Promise<T> {
  // Handle empty responses
  if (response.status === 204) {
    return undefined as T;
  }
  
  const data = await response.json();
  
  if (!response.ok) {
    throw normalizeError(response, data);
  }
  
  return data as T;
}

/**
 * Core API request function with retry logic
 */
async function request<T>(
  endpoint: string,
  options: RequestConfig = {}
): Promise<T> {
  const {
    timeout = API_CONFIG.timeout,
    retries = API_CONFIG.retries,
    retryDelay = API_CONFIG.retryDelay,
    skipCache = false,
    ...fetchOptions
  } = options;
  
  const url = `${API_CONFIG.baseURL}${endpoint}`;
  
  // Check for in-flight request (deduplication)
  const cacheKey = getCacheKey(url, fetchOptions);
  if (!skipCache && inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey) as Promise<T>;
  }
  
  // Create the request promise
  const requestPromise = (async (): Promise<T> => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Apply request interceptor
        const { url: finalUrl, options: finalOptions } = await requestInterceptor(
          url,
          fetchOptions
        );
        
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(finalUrl, {
          ...finalOptions,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        // Apply response interceptor
        return await responseInterceptor<T>(response);
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx)
        if (error instanceof Error && error.name === "APIError") {
          const apiError = error as APIError;
          if (apiError.status >= 400 && apiError.status < 500) {
            throw error;
          }
        }
        
        // Don't retry on abort
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("Request timeout");
        }
        
        // Exponential backoff
        if (attempt < retries) {
          const delay = retryDelay * Math.pow(2, attempt);
          console.warn(`[API] Retry ${attempt + 1}/${retries} after ${delay}ms`);
          await sleep(delay);
        }
      }
    }
    
    throw lastError || new Error("Request failed");
  })();
  
  // Track in-flight request
  inFlightRequests.set(cacheKey, requestPromise);
  
  try {
    const result = await requestPromise;
    return result;
  } finally {
    // Clean up in-flight request
    inFlightRequests.delete(cacheKey);
  }
}

/**
 * API Client - HTTP methods
 */
export const apiClient = {
  /**
   * GET request
   */
  get<T>(endpoint: string, options?: RequestConfig): Promise<T> {
    return request<T>(endpoint, { ...options, method: "GET" });
  },
  
  /**
   * POST request
   */
  post<T>(endpoint: string, body: unknown, options?: RequestConfig): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  
  /**
   * PUT request
   */
  put<T>(endpoint: string, body: unknown, options?: RequestConfig): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
  
  /**
   * PATCH request
   */
  patch<T>(endpoint: string, body: unknown, options?: RequestConfig): Promise<T> {
    return request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  
  /**
   * DELETE request
   */
  delete<T>(endpoint: string, options?: RequestConfig): Promise<T> {
    return request<T>(endpoint, { ...options, method: "DELETE" });
  },
};

/**
 * AI-specific API client with provider fallback
 */
export const aiClient = {
  /**
   * Generate a route from natural language
   */
  async generateRoute(params: {
    prompt: string;
    duration: number;
    difficulty: string;
    provider?: string;
  }) {
    return apiClient.post<{
      name: string;
      description: string;
      distance: number;
      elevationGain: number;
      points: Array<{ lat: number; lng: number; elevation: number }>;
      _meta?: { provider: string; duration: number };
    }>("/ai/generate-route", params);
  },
  
  /**
   * Generate narrative for a route
   */
  async generateNarrative(params: {
    elevationProfile: number[];
    theme: string;
    duration: number;
    routeName?: string;
    provider?: string;
  }) {
    return apiClient.post<{
      narrative: string;
      atmosphere: string;
      intensity: string;
    }>("/ai/generate-narrative", params);
  },
  
  /**
   * Chat with AI coach
   */
  async chat(messages: Array<{ role: string; content: string }>, provider?: string) {
    return apiClient.post<{ response: string }>("/ai/chat", {
      messages,
      provider,
    });
  },
  
  /**
   * Get coaching based on rider context
   */
  async getCoaching(
    context: {
      heartRate: number;
      power: number;
      cadence: number;
      zone: string;
      routeContext?: string;
    },
    conversationHistory?: Array<{ role: "rider" | "coach"; message: string }>,
    provider?: string
  ) {
    return apiClient.post<{
      message: string;
      intensity: "easy" | "moderate" | "hard" | "max";
      cue?: string;
    }>("/ai/chat", {
      mode: "coaching",
      context,
      conversationHistory,
      provider,
    });
  },
  
  /**
   * Agent reasoning for autonomous decisions
   */
  async agentReasoning(params: {
    agentName: string;
    personality: string;
    context: {
      telemetry: { avgBpm: number; resistance: number; duration: number };
      market: { ticketsSold: number; revenue: number; capacity: number };
      recentDecisions: string[];
    };
    provider?: string;
  }) {
    return apiClient.post<{
      action: string;
      intensity: number;
      focus: string;
      thoughtProcess: string;
    }>("/ai/agent-reasoning", params);
  },
  
  /**
   * Check AI provider health
   */
  async health() {
    return apiClient.get<{
      status: string;
      providers: { venice: boolean; gemini: boolean };
      preferredProvider: string;
    }>("/ai/health");
  },
};

// Re-export types
export type { APIError, RequestConfig };
