/**
 * Route Preview Card
 * Compact card showing route information for class browsing
 * Used in rider class browser and instructor dashboards
 */

"use client";

import { useState } from "react";
import RouteVisualizer from "./route-visualizer";
import type { SavedRoute } from "../lib/route-library";
import type { EnhancedClassMetadata } from "../lib/contracts-extended";

type RoutePreviewCardProps = {
  route: SavedRoute | EnhancedClassMetadata["route"];
  variant?: "compact" | "detailed";
  onPreview?: () => void;
  className?: string;
};

export function RoutePreviewCard({
  route,
  variant = "compact",
  onPreview,
  className = "",
}: RoutePreviewCardProps) {
  const [showVisualization, setShowVisualization] = useState(false);

  // Extract data safely from both types
  const routeData = {
    name: route.name || 'Unnamed Route',
    distance: 'estimatedDistance' in route ? route.estimatedDistance : 0,
    duration: 'estimatedDuration' in route ? route.estimatedDuration : 0,
    elevationGain: 'elevationGain' in route ? route.elevationGain : 0,
    storyBeats: 'storyBeats' in route ? route.storyBeats : [],
    theme: 'theme' in route ? route.theme : 'neon',
  };

  const beatsCount = routeData.storyBeats.length;

  if (variant === "compact") {
    return (
      <div
        className={`group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-4 transition-all hover:border-white/20 hover:from-white/10 hover:to-white/5 ${className}`}
      >
        {/* Route Icon */}
        <div className="absolute top-3 right-3 h-8 w-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
          <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>

        {/* Route Name */}
        <h4 className="pr-10 text-sm font-medium text-white/90 line-clamp-1">
          {routeData.name}
        </h4>

        {/* Route Stats */}
        <div className="mt-2 flex items-center gap-3 text-xs text-white/50">
          <span>{(routeData.distance).toFixed(1)} km</span>
          <span>•</span>
          <span>{routeData.duration} min</span>
          {routeData.elevationGain > 0 && (
            <>
              <span>•</span>
              <span>{routeData.elevationGain}m</span>
            </>
          )}
        </div>

        {/* Story Beats Count */}
        {beatsCount > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            <div className="flex -space-x-1">
              {routeData.storyBeats.slice(0, 3).map((beat, i) => (
                <div
                  key={i}
                  className={`h-5 w-5 rounded-full border border-white/10 flex items-center justify-center text-[10px] ${
                    beat.type === 'climb' ? 'bg-orange-500/30 text-orange-300' :
                    beat.type === 'sprint' ? 'bg-red-500/30 text-red-300' :
                    beat.type === 'drop' ? 'bg-blue-500/30 text-blue-300' :
                    'bg-green-500/30 text-green-300'
                  }`}
                >
                  {beat.type === 'climb' ? '▲' :
                   beat.type === 'sprint' ? '⚡' :
                   beat.type === 'drop' ? '▼' : '○'}
                </div>
              ))}
            </div>
            {beatsCount > 3 && (
              <span className="text-[10px] text-white/40">+{beatsCount - 3}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Detailed variant
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 overflow-hidden ${className}`}>
      {/* Preview Visualization */}
      <div className="relative h-48 bg-gradient-to-br from-indigo-900/20 to-purple-900/20">
        {showVisualization ? (
          <RouteVisualizer
            elevationProfile={routeData.storyBeats.map(() => Math.random() * 100)}
            theme={routeData.theme as 'neon' | 'alpine' | 'mars'}
            className="h-full"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={() => setShowVisualization(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-sm text-white/70 hover:bg-white/20 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Preview Route
            </button>
          </div>
        )}
      </div>

      {/* Route Info */}
      <div className="p-4">
        <h4 className="text-base font-medium text-white">{routeData.name}</h4>
        
        <div className="mt-3 grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/40">Distance</p>
            <p className="text-sm font-medium text-white/90">{routeData.distance.toFixed(1)} km</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/40">Duration</p>
            <p className="text-sm font-medium text-white/90">{routeData.duration} min</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/40">Elevation</p>
            <p className="text-sm font-medium text-white/90">{routeData.elevationGain}m</p>
          </div>
        </div>

        {/* Story Beats */}
        {beatsCount > 0 && (
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Story Beats</p>
            <div className="flex flex-wrap gap-2">
              {routeData.storyBeats.slice(0, 4).map((beat, i) => (
                <span
                  key={i}
                  className={`px-2 py-1 rounded-full text-[10px] ${
                    beat.type === 'climb' ? 'bg-orange-500/20 text-orange-300' :
                    beat.type === 'sprint' ? 'bg-red-500/20 text-red-300' :
                    beat.type === 'drop' ? 'bg-blue-500/20 text-blue-300' :
                    'bg-green-500/20 text-green-300'
                  }`}
                >
                  {beat.label}
                </span>
              ))}
              {beatsCount > 4 && (
                <span className="px-2 py-1 rounded-full text-[10px] bg-white/10 text-white/50">
                  +{beatsCount - 4} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {onPreview && (
          <button
            onClick={onPreview}
            className="mt-4 w-full py-2 rounded-lg bg-indigo-500/20 text-sm text-indigo-300 hover:bg-indigo-500/30 transition-colors"
          >
            Use This Route
          </button>
        )}
      </div>
    </div>
  );
}
