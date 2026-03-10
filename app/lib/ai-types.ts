/**
 * Shared AI Types and Interfaces
 * 
 * Defines the core data structures for AI interactions across different providers (Gemini, Venice).
 * Centralizing these types prevents circular dependencies and provider coupling.
 */

// Route Generation Types
export type RouteDifficulty = "easy" | "moderate" | "hard" | "extreme";

export type RouteTheme = 
  | "coastal" 
  | "mountain" 
  | "urban" 
  | "forest" 
  | "desert" 
  | "alpine" 
  | "neon" 
  | "mars" 
  | "custom";

export type StoryBeatType = "climb" | "sprint" | "drop" | "rest" | "scenery" | "push";

export type StreamStatus = { stage: string; message: string };

export interface RouteRequest {
  prompt: string;
  duration: number;
  difficulty: RouteDifficulty;
  preferences?: string;
  theme?: RouteTheme;
  fitnessLevel?: "beginner" | "intermediate" | "advanced" | "elite";
}

export interface RouteResponse {
  name: string;
  description: string;
  coordinates: Array<{ lat: number; lng: number; ele?: number }>;
  estimatedDistance: number;
  estimatedDuration: number;
  elevationGain: number;
  elevationLoss: number;
  maxElevation: number;
  minElevation: number;
  avgGrade: number;
  maxGrade: number;
  storyBeats: Array<{
    progress: number;
    label: string;
    type: StoryBeatType;
    description?: string;
    intensity: number; // 1-10
  }>;
  weatherContext?: string;
  terrainTags: string[];
  difficultyScore: number; // 1-100
  estimatedCalories: number;
  zones: Array<{
    name: string;
    startProgress: number;
    endProgress: number;
    type: "warmup" | "endurance" | "tempo" | "threshold" | "vo2max" | "recovery";
    description: string;
  }>;
}

// Coaching & Agent Types
export interface CoachingContext {
  riderHeartRate: number;
  targetHeartRate: number;
  currentResistance: number;
  currentCadence: number;
  workoutProgress: number; // 0-1
  routeStoryBeat?: string;
  recentPerformance: "below" | "on" | "above" | "crushing";
  fatigueLevel: "low" | "moderate" | "high";
}

export interface CoachingResponse {
  message: string;
  tone: "encouraging" | "challenging" | "calm" | "energetic" | "tactical";
  action?: {
    type: "increase_resistance" | "decrease_resistance" | "maintain" | "sprint" | "recover";
    value?: number;
    duration?: number;
  };
  motivation: string;
  technique?: string;
}

export interface AgentDecision {
  thoughtProcess: string;
  action: string;
  parameters: Record<string, unknown>;
  confidence: number;
}
