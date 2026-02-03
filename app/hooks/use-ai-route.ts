/**
 * Unified AI Route Generation Hook
 * Consolidates route AI capabilities with existing AI instructor logic
 */

"use client";

import { useState } from "react";
import { getAIService, type RouteGenerationParams, type GeneratedRoute } from "../lib/ai-service";
import { convertToGpxSummary, downloadGPX } from "../lib/route-generation";
import type { GpxSummary } from "../routes/builder/gpx-uploader";

type RouteGenerationState = {
  isGenerating: boolean;
  error: string | null;
  route: GeneratedRoute | null;
  gpxSummary: GpxSummary | null;
};

export function useAIRoute() {
  const [state, setState] = useState<RouteGenerationState>({
    isGenerating: false,
    error: null,
    route: null,
    gpxSummary: null,
  });

  const aiService = getAIService();

  /**
   * Generate route from natural language prompt
   */
  const generateRoute = async (params: RouteGenerationParams) => {
    setState((prev) => ({ ...prev, isGenerating: true, error: null }));

    try {
      const route = await aiService.generateRoute(params);
      const gpxSummary = convertToGpxSummary(route);

      setState({
        isGenerating: false,
        error: null,
        route,
        gpxSummary,
      });

      return { route, gpxSummary };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to generate route";
      setState((prev) => ({
        ...prev,
        isGenerating: false,
        error: errorMessage,
      }));
      throw error;
    }
  };

  /**
   * Generate narrative description for current route
   */
  const generateNarrative = async (theme: string, duration: number) => {
    if (!state.gpxSummary) {
      throw new Error("No route loaded");
    }

    try {
      const narrative = await aiService.generateNarrative(
        state.gpxSummary.elevationProfile,
        theme,
        duration
      );
      return narrative;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to generate narrative";
      setState((prev) => ({ ...prev, error: errorMessage }));
      throw error;
    }
  };

  /**
   * Export current route as GPX file
   */
  const exportGPX = (metadata?: { name?: string; author?: string }) => {
    if (!state.route) {
      throw new Error("No route to export");
    }
    downloadGPX(state.route, metadata);
  };

  /**
   * Clear current route
   */
  const clearRoute = () => {
    setState({
      isGenerating: false,
      error: null,
      route: null,
      gpxSummary: null,
    });
  };

  return {
    ...state,
    generateRoute,
    generateNarrative,
    exportGPX,
    clearRoute,
  };
}
