"use client";

import { useState, useCallback } from "react";

export interface RideAnalysis {
  summary: string;
  improvements: string[];
  focusAreas: string[];
  tips: string[];
  comparison: {
    effortTrend: "improving" | "declining" | "stable";
    powerTrend: "improving" | "declining" | "stable" | "insufficient_data";
    heartRateTrend: "improving" | "declining" | "stable" | "insufficient_data";
  };
  encouragement: string;
}

export interface HomeworkRecommendation {
  name: string;
  description: string;
  duration: number;
  intensity: "easy" | "moderate" | "hard";
  focus: string;
  structure: string[];
  rationale: string;
}

export interface InstructorInsight {
  type: "engagement" | "improvement" | "concern" | "opportunity";
  rider: string;
  message: string;
  action: string;
}

export interface InstructorInsights {
  summary: string;
  insights: InstructorInsight[];
  rosterHealth: "healthy" | "needs_attention" | "at_risk";
  recommendations: string[];
}

export interface TrainingPlan {
  title: string;
  goal: string;
  durationWeeks: number;
  currentFitness: string;
  weeks: Array<{
    week: number;
    focus: string;
    workouts: Array<{
      day: string;
      type: string;
      name: string;
      duration: number;
      description: string;
      intensity: string;
    }>;
  }>;
  progression: string;
  tips: string[];
}

function useAIRequest() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(async <T,>(url: string, body?: Record<string, unknown>): Promise<T | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.message || "Request failed");
        return null;
      }
      return await res.json() as T;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, error, call };
}

/**
 * useRideAnalysis — get AI analysis of a completed ride vs history
 */
export function useRideAnalysis() {
  const { call, isLoading, error } = useAIRequest();
  const analyze = useCallback((rideId?: string) =>
    call<RideAnalysis>("/api/ai/ride-analysis", rideId ? { rideId } : {}),
  [call]);

  return { analyze, isLoading, error };
}

/**
 * useHomeworkRecommendation — get AI-recommended practice workout
 */
export function useHomeworkRecommendation() {
  const { call, isLoading, error } = useAIRequest();
  const recommend = useCallback((riderAddress?: string) =>
    call<HomeworkRecommendation>("/api/ai/homework-recommendations", riderAddress ? { riderAddress } : {}),
  [call]);

  return { recommend, isLoading, error };
}

/**
 * useInstructorInsights — get AI insights about instructor's roster
 */
export function useInstructorInsights() {
  const { call, isLoading, error } = useAIRequest();
  const getInsights = useCallback(() =>
    call<InstructorInsights>("/api/ai/instructor-insights"),
  [call]);

  return { getInsights, isLoading, error };
}

/**
 * useTrainingPlan — generate a multi-week AI training plan
 */
export function useTrainingPlan() {
  const { call, isLoading, error } = useAIRequest();
  const generate = useCallback((weeks?: number, goal?: string) =>
    call<TrainingPlan>("/api/ai/training-plan", { weeks, goal }),
  [call]);

  return { generate, isLoading, error };
}
