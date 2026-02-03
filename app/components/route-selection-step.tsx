/**
 * Route Selection Step
 * First step in class creation - choose or generate a route
 * Integrates with AI Route Generator and Route Library
 */

"use client";

import { useState } from "react";
import { useRouteLibrary } from "../hooks/use-route-library";
import { AIRouteGenerator } from "./ai-route-generator";
import { RouteLibrary } from "./route-library";
import type { SavedRoute } from "../lib/route-library";
import type { GpxSummary } from "../routes/builder/gpx-uploader";
import RouteVisualizer from "./route-visualizer";

type RouteSelectionStepProps = {
  onRouteSelected: (route: SavedRoute, gpxSummary: GpxSummary) => void;
  selectedRoute?: SavedRoute | null;
};

export function RouteSelectionStep({
  onRouteSelected,
  selectedRoute,
}: RouteSelectionStepProps) {
  const [mode, setMode] = useState<"generate" | "library" | "preview">(
    selectedRoute ? "preview" : "generate"
  );
  const { routes } = useRouteLibrary();

  const handleRouteGenerated = (gpxSummary: GpxSummary) => {
    // When a route is generated, we need to convert it to SavedRoute
    // For now, we'll let the user save it to library first
    setMode("library");
  };

  const handleRouteFromLibrary = (route: SavedRoute) => {
    // Convert route to GPX summary format
    const gpxSummary: GpxSummary = {
      trackPoints: route.coordinates.length,
      minElevation: null,
      maxElevation: null,
      distanceKm: route.estimatedDistance,
      segments: route.storyBeats.map(beat => ({
        label: beat.label,
        minutes: Math.floor(beat.progress * route.estimatedDuration),
        zone: beat.type === 'sprint' ? 'Zone 5' : beat.type === 'climb' ? 'Zone 4' : 'Zone 2',
      })),
      elevationProfile: route.coordinates.map(c => c.ele || 0),
      storyBeats: route.storyBeats,
    };
    onRouteSelected(route, gpxSummary);
    setMode("preview");
  };

  const handleChangeRoute = () => {
    setMode("generate");
  };

  // Preview mode - show selected route
  if (mode === "preview" && selectedRoute) {
    return (
      <div className="space-y-6">
        {/* Selected Route Card */}
        <div className="rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/10 to-green-500/5 p-6 backdrop-blur">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-[10px] uppercase tracking-[0.2em] text-green-400 font-semibold">
                  Route Selected
                </p>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                {selectedRoute.name}
              </h3>
              <p className="text-sm text-white/70 leading-relaxed">
                {selectedRoute.description}
              </p>
            </div>
            
            <button
              onClick={handleChangeRoute}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Change Route
            </button>
          </div>

          {/* Route Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-white/50">Distance</p>
              <p className="text-lg font-bold text-white mt-1">
                {selectedRoute.estimatedDistance.toFixed(1)}
                <span className="text-xs font-normal text-white/50 ml-1">km</span>
              </p>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-white/50">Duration</p>
              <p className="text-lg font-bold text-white mt-1">
                {selectedRoute.estimatedDuration}
                <span className="text-xs font-normal text-white/50 ml-1">min</span>
              </p>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-white/50">Elevation</p>
              <p className="text-lg font-bold text-white mt-1">
                {selectedRoute.elevationGain}
                <span className="text-xs font-normal text-white/50 ml-1">m</span>
              </p>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-white/50">Story Beats</p>
              <p className="text-lg font-bold text-white mt-1">
                {selectedRoute.storyBeats.length}
              </p>
            </div>
          </div>
        </div>

        {/* Route Visualization */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)] mb-4">
            Route Preview
          </p>
          <div className="h-64 rounded-xl overflow-hidden">
            <RouteVisualizer
              elevationProfile={selectedRoute.coordinates.map((c) => c.ele || 0)}
              theme="neon"
              storyBeats={selectedRoute.storyBeats}
              className="h-full"
            />
          </div>
        </div>

        {/* Info Box */}
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-400">Route will be uploaded to Walrus</p>
              <p className="text-xs text-blue-400/70 mt-1">
                When you deploy this class, the route will be permanently stored on Walrus for riders to access.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mode selection - Generate or Browse
  if (mode === "generate") {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Choose Your Route</h2>
          <p className="text-white/60">
            Generate a new route with AI or select from your library
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-3 p-1 rounded-lg bg-black/20 border border-white/10">
          <button
            onClick={() => setMode("generate")}
            className={`flex-1 rounded-md px-4 py-3 text-sm font-medium transition-all ${
              mode === "generate"
                ? "bg-white/10 text-white ring-1 ring-white/20"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI Generate
            </div>
          </button>
          <button
            onClick={() => setMode("library")}
            className={`flex-1 rounded-md px-4 py-3 text-sm font-medium transition-all ${
              (mode as string) === "library"
                ? "bg-white/10 text-white ring-1 ring-white/20"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              Browse Library ({routes.length})
            </div>
          </button>
        </div>

        {/* AI Route Generator */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur">
          <AIRouteGenerator
            onRouteGenerated={handleRouteGenerated}
          />
        </div>

        {/* Quick Tip */}
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-indigo-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-indigo-400">Pro Tip</p>
              <p className="text-xs text-indigo-400/70 mt-1">
                Generate your route first and save it to your library. This way you can reuse it for future classes.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Library mode
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Select from Library</h2>
          <p className="text-white/60">Choose a saved route for this class</p>
        </div>
        <button
          onClick={() => setMode("generate")}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
        >
          ← Back to Generate
        </button>
      </div>

      {/* Route Library */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur">
        <RouteLibrary
          onRouteSelect={(gpxSummary) => {
            // Find the route from the summary and handle selection
            const route = routes.find(r => 
              r.estimatedDistance === gpxSummary.distanceKm &&
              r.coordinates.length === gpxSummary.trackPoints
            );
            if (route) handleRouteFromLibrary(route);
          }}
        />
      </div>
    </div>
  );
}
