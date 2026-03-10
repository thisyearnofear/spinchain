/**
 * Route Selection Step
 * First step in class creation - choose or generate a route
 * Integrates with AI Route Generator and Route Library
 */

"use client";

import { useState } from "react";
import { useRouteLibrary } from "../../../hooks/common/use-route-library";
import { AIRouteGenerator } from "../../../components/features/ai/ai-route-generator";
import { RouteLibrary } from "./route-library";
import type { SavedRoute } from "../../../lib/route-library";
import type { GpxSummary, StoryBeat } from "../../../routes/builder/gpx-uploader";
import RouteVisualizer from "./route-visualizer";
import type { VisualizerTheme } from "./visualizer-theme";
import type { RouteAnalysisResponse } from "../../../api/ai/analyze-route/route";

// Smart Config types
export type SmartConfigResult = {
  formData: {
    name: string;
    description: string;
    curveType: "linear" | "exponential";
    basePrice: number;
    maxPrice: number;
    aiPersonality: "zen" | "drill-sergeant" | "data";
    rewardThreshold: number;
    rewardAmount: number;
  };
  analysis: RouteAnalysisResponse;
};

type RouteSelectionStepProps = {
  onRouteSelected: (route: SavedRoute, gpxSummary: GpxSummary, smartConfig?: SmartConfigResult) => void;
  selectedRoute?: SavedRoute | null;
};

export function RouteSelectionStep({
  onRouteSelected,
  selectedRoute,
}: RouteSelectionStepProps) {
  const [mode, setMode] = useState<"generate" | "library" | "preview">(
    selectedRoute ? "preview" : "generate"
  );
  const [previewTheme, setPreviewTheme] = useState<VisualizerTheme>("neon");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const { routes } = useRouteLibrary();

  const themes: VisualizerTheme[] = ["neon", "alpine", "mars", "anime", "rainbow"];

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
      segments: route.storyBeats.map((beat: StoryBeat) => ({
        label: beat.label,
        minutes: Math.floor(beat.progress * route.estimatedDuration),
        zone: beat.type === 'sprint' ? 'Zone 5' : beat.type === 'climb' ? 'Zone 4' : 'Zone 2',
      })),
      elevationProfile: route.coordinates.map((c) => c.ele || 0),
      storyBeats: route.storyBeats,
    };
    onRouteSelected(route, gpxSummary);
    setMode("preview");
  };

  const handleChangeRoute = () => {
    setMode("generate");
    setAnalysisError(null);
  };

  const analyzeRouteWithAI = async (route: SavedRoute): Promise<SmartConfigResult | null> => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    
    try {
      const response = await fetch("/api/ai/analyze-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeName: route.name,
          routeDescription: route.description,
          distance: route.estimatedDistance,
          duration: route.estimatedDuration,
          elevationGain: route.elevationGain,
          storyBeats: route.storyBeats,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze route");
      }

      const analysis: RouteAnalysisResponse = await response.json();

      // Map analysis to form data
      const smartConfig: SmartConfigResult = {
        formData: {
          name: analysis.suggestedName,
          description: analysis.suggestedDescription,
          curveType: analysis.pricingCurve,
          basePrice: analysis.basePrice,
          maxPrice: analysis.maxPrice,
          aiPersonality: analysis.aiPersonality,
          rewardThreshold: analysis.rewardThreshold,
          rewardAmount: analysis.rewardAmount,
        },
        analysis,
      };

      return smartConfig;
    } catch (error) {
      console.error("Smart config error:", error);
      setAnalysisError("AI analysis failed. Using defaults.");
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSmartConfig = async () => {
    if (!selectedRoute) return;
    
    const smartConfig = await analyzeRouteWithAI(selectedRoute);
    
    // Convert route to GPX summary format
    const gpxSummary: GpxSummary = {
      trackPoints: selectedRoute.coordinates.length,
      minElevation: null,
      maxElevation: null,
      distanceKm: selectedRoute.estimatedDistance,
      segments: selectedRoute.storyBeats.map((beat: StoryBeat) => ({
        label: beat.label,
        minutes: Math.floor(beat.progress * selectedRoute.estimatedDuration),
        zone: beat.type === 'sprint' ? 'Zone 5' : beat.type === 'climb' ? 'Zone 4' : 'Zone 2',
      })),
      elevationProfile: selectedRoute.coordinates.map((c) => c.ele || 0),
      storyBeats: selectedRoute.storyBeats,
    };
    
    onRouteSelected(selectedRoute, gpxSummary, smartConfig || undefined);
  };

  // Preview mode - show selected route
  if (mode === "preview" && selectedRoute) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Selected Route Card - Glassmorphism 2.0 */}
        <div className="group relative rounded-3xl border border-white/10 bg-black/40 p-8 backdrop-blur-3xl shadow-2xl overflow-hidden">
          {/* Tactical Border Glow */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-green-500/20 rounded-3xl blur opacity-30 group-hover:opacity-70 transition duration-1000"></div>
          
          <div className="relative flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                  <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.4em] text-green-400 font-black">
                    Neural Route Locked
                  </p>
                  <h3 className="text-3xl font-black text-white tracking-tighter">
                    {selectedRoute.name}
                  </h3>
                </div>
              </div>
              <p className="text-sm text-white/60 leading-relaxed max-w-xl font-medium">
                {selectedRoute.description}
              </p>
            </div>
            
            <button
              onClick={handleChangeRoute}
              className="rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-white/10 hover:border-white/20 active:scale-95"
            >
              Recalibrate
            </button>
          </div>

          {/* Route Stats - Tactical Grid */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Distance", value: selectedRoute.estimatedDistance.toFixed(1), unit: "km" },
              { label: "Duration", value: selectedRoute.estimatedDuration, unit: "min" },
              { label: "Elevation", value: selectedRoute.elevationGain, unit: "m" },
              { label: "Beats", value: selectedRoute.storyBeats.length, unit: "zones" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-white/5 border border-white/5 p-4 transition-all hover:bg-white/10">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold mb-1">{stat.label}</p>
                <p className="text-xl font-black text-white">
                  {stat.value}
                  <span className="text-[10px] font-normal text-white/30 ml-1 uppercase">{stat.unit}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Route Visualization - Cinematic Preview */}
        <div className="rounded-3xl border border-white/10 bg-black/40 p-1 backdrop-blur-3xl overflow-hidden relative group">
          <div className="absolute top-6 left-8 z-10">
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/40 font-black mb-4">
              Environment Hot-Swap
            </p>
            <div className="flex gap-2">
              {themes.map((theme) => (
                <button
                  key={theme}
                  onClick={() => setPreviewTheme(theme)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                    previewTheme === theme 
                      ? "bg-white text-black shadow-lg shadow-white/20" 
                      : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[400px] rounded-[22px] overflow-hidden">
            <RouteVisualizer
              elevationProfile={selectedRoute.coordinates.map((c) => c.ele || 0)}
              theme={previewTheme}
              storyBeats={selectedRoute.storyBeats}
              className="h-full"
            />
          </div>
          
          {/* Tactical Overlay Lines */}
          <div className="absolute inset-0 pointer-events-none border-[1px] border-white/5 rounded-[24px]" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-b-full" />
        </div>

        {/* Smart Config Button - Neural Intelligence Look */}
        <button
          onClick={handleSmartConfig}
          disabled={isAnalyzing}
          className="group relative w-full rounded-3xl border border-indigo-500/30 bg-black/40 p-8 text-left transition-all hover:border-indigo-500/50 hover:bg-indigo-500/5 disabled:opacity-50 overflow-hidden"
        >
          {/* Tactical Glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 blur opacity-50 group-hover:opacity-100 transition duration-1000"></div>

          <div className="relative flex items-center gap-8">
            <div className="relative h-20 w-20 flex items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 overflow-hidden">
              {isAnalyzing ? (
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="h-12 w-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                   <div className="absolute h-6 w-6 bg-indigo-500 rounded-full animate-pulse blur-sm" />
                </div>
              ) : (
                <div className="relative">
                  <svg className="h-10 w-10 text-indigo-400 group-hover:scale-110 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <div className="absolute -inset-2 bg-indigo-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">
                  {isAnalyzing ? "Neural Processing" : "Neural Intelligence Stream"}
                </p>
              </div>
              <h4 className="text-2xl font-black text-white tracking-tighter mb-2">
                {isAnalyzing ? "Analyzing Core Telemetry..." : "Initiate Smart Config"}
              </h4>
              <p className="text-sm text-white/50 font-medium leading-relaxed max-w-lg">
                {isAnalyzing 
                  ? "Evaluating elevation delta, segment difficulty, and target output to calibrate pricing and instructor personality nodes..." 
                  : "Let AI auto-calibrate pricing curves, difficulty thresholds, and tactical personality based on route characteristics."}
              </p>
            </div>
            
            {!isAnalyzing && (
              <div className="h-12 w-12 rounded-full border border-white/10 flex items-center justify-center group-hover:border-indigo-500/50 group-hover:bg-indigo-500/10 transition-all">
                <svg className="h-6 w-6 text-white/20 group-hover:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            )}
          </div>
          
          {/* Progress Bar (Visible during analysis) */}
          {isAnalyzing && (
            <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5">
              <div className="h-full bg-indigo-500 animate-[progress_2s_ease-in-out_infinite]" style={{ width: '30%' }} />
            </div>
          )}
        </button>

        {analysisError && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300 font-bold backdrop-blur-xl animate-in zoom-in-95 duration-300">
             <span className="mr-2">⚠️</span> {analysisError}
          </div>
        )}

        {/* Info Box - Deep Glass */}
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6 backdrop-blur-2xl">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-black text-blue-400 uppercase tracking-widest mb-1">Decentralized Storage Node</p>
              <p className="text-xs text-blue-400/60 leading-relaxed font-medium">
                Upon deployment, this route is permanently committed to Walrus Protocol, ensuring immutable access for all riders.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mode selection - Generate or Browse - Vision Pro Style
  if (mode === "generate") {
    return (
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header - Tactical */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
             <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
             <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">Synthesis Engine</p>
          </div>
          <h2 className="text-4xl font-black text-white tracking-tighter mb-4">Choose Your Track</h2>
          <p className="text-white/50 font-medium max-w-lg mx-auto leading-relaxed">
            Generate a unique procedural world with AI or select a verified route from your decentralized library.
          </p>
        </div>

        {/* Mode Toggle - Glassmorphism 2.0 */}
        <div className="flex gap-4 p-2 rounded-[32px] bg-black/40 border border-white/10 backdrop-blur-3xl max-w-xl mx-auto">
          <button
            onClick={() => setMode("generate")}
            className={`flex-1 rounded-[24px] px-6 py-4 text-xs font-black uppercase tracking-widest transition-all ${
              mode === "generate"
                ? "bg-white text-black shadow-2xl shadow-white/10"
                : "text-white/40 hover:text-white hover:bg-white/5"
            }`}
          >
            <div className="flex items-center justify-center gap-3">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI Synthesis
            </div>
          </button>
          <button
            onClick={() => setMode("library")}
            className={`flex-1 rounded-[24px] px-6 py-4 text-xs font-black uppercase tracking-widest transition-all ${
              (mode as string) === "library"
                ? "bg-white text-black shadow-2xl shadow-white/10"
                : "text-white/40 hover:text-white hover:bg-white/5"
            }`}
          >
            <div className="flex items-center justify-center gap-3">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              Library ({routes.length})
            </div>
          </button>
        </div>

        {/* AI Route Generator */}
        <div className="animate-in fade-in zoom-in-95 duration-700">
          <AIRouteGenerator
            onRouteGenerated={handleRouteGenerated}
          />
        </div>

        {/* Quick Tip - Deep Glass */}
        <div className="rounded-3xl border border-indigo-500/20 bg-indigo-500/5 p-8 backdrop-blur-3xl">
          <div className="flex items-start gap-6">
            <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <svg className="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-black text-indigo-400 uppercase tracking-[0.3em] mb-2">Protocol Instruction</p>
              <p className="text-sm text-indigo-400/60 leading-relaxed font-medium">
                Routes generated via Synthesis are unique to your session. Commit them to your library to reuse across multiple class contracts.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Library mode - Vision Pro Style
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex items-center justify-between bg-black/40 border border-white/10 p-8 rounded-3xl backdrop-blur-3xl shadow-2xl">
        <div>
          <div className="inline-flex items-center gap-2 mb-3">
             <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
             <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Data Repository</p>
          </div>
          <h2 className="text-3xl font-black text-white tracking-tighter">Decentralized Library</h2>
          <p className="text-white/50 font-medium mt-1">Select a verified route for this class contract.</p>
        </div>
        <button
          onClick={() => setMode("generate")}
          className="rounded-full border border-white/10 bg-white/5 px-8 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-white/10 hover:border-white/20 active:scale-95"
        >
          ← Return to Synthesis
        </button>
      </div>

      {/* Route Library - Tactical Display */}
      <div className="rounded-[40px] border border-white/10 bg-black/40 p-10 backdrop-blur-3xl shadow-2xl relative overflow-hidden">
        {/* Subtle Decorative Grid */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]" />
        
        <div className="relative">
          <RouteLibrary
            onRouteSelect={(gpxSummary) => {
              // Find the route from the summary and handle selection
              const route = routes.find((r) =>
                r.estimatedDistance === gpxSummary.distanceKm &&
                r.coordinates.length === gpxSummary.trackPoints
              );
              if (route) handleRouteFromLibrary(route);
            }}
          />
        </div>
      </div>
    </div>
  );
}
