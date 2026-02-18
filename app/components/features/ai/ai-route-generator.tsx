/**
 * AI Route Generator Component
 * Natural language interface for route creation - integrates into existing route builder
 */

"use client";

import { useState } from "react";
import { useAIRoute } from "../../../hooks/ai/use-ai-route";
import { useVoiceInput } from "../../../hooks/ai/use-voice-input";
import { useRouteLibrary } from "../../../hooks/common/use-route-library";
import { RouteLibrary } from "../route/route-library";
import type { RouteRequest } from "../../../lib/ai-service";
import type { GpxSummary } from "../../../routes/builder/gpx-uploader";

type AIRouteGeneratorProps = {
  onRouteGenerated?: (gpxSummary: GpxSummary) => void;
  className?: string;
};

export function AIRouteGenerator({
  onRouteGenerated,
  className = "",
}: AIRouteGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(45);
  const [difficulty, setDifficulty] = useState<"easy" | "moderate" | "hard">("moderate");
  const [showLibrary, setShowLibrary] = useState(false);
  
  const { isGenerating, error, route, gpxSummary, generateRoute, exportGPX, clearRoute } =
    useAIRoute();
  
  const { saveRoute: saveToLibrary } = useRouteLibrary();

  const {
    isListening,
    isSupported: isVoiceSupported,
    transcript,
    interimTranscript,
    error: voiceError,
    toggleListening,
    clearTranscript,
  } = useVoiceInput({
    continuous: false,
    interimResults: true,
    onResult: (finalTranscript: string) => {
      // Append voice input to prompt
      setPrompt((prev) => (prev ? `${prev} ${finalTranscript}` : finalTranscript));
    },
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    try {
      const params: RouteRequest = {
        prompt,
        duration,
        difficulty,
      };

      const result = await generateRoute(params);
      
      if (onRouteGenerated && result.gpxSummary) {
        onRouteGenerated(result.gpxSummary);
      }
    } catch (err) {
      console.error("Failed to generate route:", err);
    }
  };

  const handleExport = () => {
    try {
      exportGPX({ author: "SpinChain AI" });
    } catch (err) {
      console.error("Failed to export GPX:", err);
    }
  };

  const handleSaveToLibrary = () => {
    if (!route) return;
    
    try {
      const tags = [];
      if (route.elevationGain > 300) tags.push("climbing");
      if (route.estimatedDistance > 40) tags.push("long-distance");
      if (difficulty === "hard") tags.push("challenging");
      
      saveToLibrary(route, {
        author: "AI Generated",
        tags,
      });
      
      // Show success message (you can add a toast here)
      alert(`"${route.name}" saved to library!`);
    } catch (err) {
      console.error("Failed to save route:", err);
      alert("Failed to save route. Library may be full.");
    }
  };

  if (showLibrary) {
    return (
      <RouteLibrary
        onRouteSelect={(gpxSummary: GpxSummary) => {
          if (onRouteGenerated) {
            onRouteGenerated(gpxSummary);
          }
          setShowLibrary(false);
        }}
        onClose={() => setShowLibrary(false)}
      />
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Prompt Input with Voice */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs uppercase tracking-wider text-[color:var(--muted)]">
            Describe Your Route
          </label>
          {isVoiceSupported && (
            <button
              onClick={toggleListening}
              disabled={isGenerating}
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                isListening
                  ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/50 animate-pulse"
                  : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
              title={isListening ? "Stop voice input" : "Start voice input"}
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              {isListening ? "Listening..." : "Voice"}
            </button>
          )}
        </div>
        <div className="relative">
          <textarea
            value={prompt + (isListening ? interimTranscript : "")}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., 'A coastal climb with ocean views starting from Santa Monica' or 'Fast urban sprint through downtown with minimal stops'"
            className="w-full h-24 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            disabled={isGenerating || isListening}
          />
          {isListening && (
            <div className="absolute bottom-3 right-3 flex items-center gap-2 text-xs text-red-400">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              Listening...
            </div>
          )}
        </div>
        {voiceError && (
          <p className="text-xs text-red-400/80">{voiceError}</p>
        )}
      </div>

      {/* Duration and Difficulty Controls */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-[color:var(--muted)]">
            Duration (min)
          </label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            min={20}
            max={120}
            step={5}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            disabled={isGenerating}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-[color:var(--muted)]">
            Difficulty
          </label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as "easy" | "moderate" | "hard")}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            disabled={isGenerating}
          >
            <option value="easy">Easy</option>
            <option value="moderate">Moderate</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="group relative flex-1 overflow-hidden rounded-lg bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:shadow-xl hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* Shimmer effect on hover */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            
            {isGenerating ? (
              <span className="relative flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                <span className="animate-pulse">Generating...</span>
              </span>
            ) : (
              <span className="relative flex items-center justify-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Route
              </span>
            )}
          </button>

          <button
            onClick={() => setShowLibrary(true)}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
            title="Browse saved routes"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </button>
        </div>

        {route && (
          <div className="flex gap-2">
            <button
              onClick={handleSaveToLibrary}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Save to Library
            </button>
            <button
              onClick={handleExport}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Export GPX
            </button>
            <button
              onClick={clearRoute}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Error Display with Animation */}
      {error && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-xl border border-red-500/30 bg-gradient-to-br from-red-500/20 to-red-500/5 p-4 backdrop-blur">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-400">{error}</p>
              <p className="text-xs text-red-400/70 mt-1">Please try again or modify your prompt</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Loading State Preview */}
      {isGenerating && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 p-6 backdrop-blur">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500" />
              <svg className="absolute inset-0 m-auto h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Generating your route...</p>
              <p className="text-xs text-white/60 mt-1">AI is analyzing terrain and creating story beats</p>
            </div>
          </div>
          
          {/* Progress Indicators */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-3/4 rounded-full bg-indigo-400 animate-pulse" />
              </div>
              <span className="text-xs text-white/60">Analyzing...</span>
            </div>
          </div>
        </div>
      )}

      {/* Route Summary with Enhanced Animation */}
      {route && gpxSummary && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-3">
          {/* Main Route Card */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-5 backdrop-blur">
            {/* Glow Effect */}
            <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl" />
            
            <div className="relative">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)] mb-2">
                    Generated Route
                  </p>
                  <h3 className="text-xl font-bold text-white mb-1.5 leading-tight">
                    {route.name}
                  </h3>
                  <p className="text-sm text-white/70 leading-relaxed">
                    {route.description}
                  </p>
                </div>
                
                {/* Difficulty Badge */}
                <div className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                  difficulty === "hard" 
                    ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                    : difficulty === "moderate"
                    ? "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30"
                    : "bg-green-500/20 text-green-400 ring-1 ring-green-500/30"
                }`}>
                  {difficulty}
                </div>
              </div>

              {/* Stats Grid with Icons */}
              <div className="grid grid-cols-3 gap-3 mt-5">
                <div className="group rounded-xl bg-white/5 p-3.5 transition-all hover:bg-white/10">
                  <div className="flex items-center gap-2 mb-1.5">
                    <svg className="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <p className="text-[10px] uppercase tracking-wider text-white/50 font-medium">Distance</p>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {route.estimatedDistance.toFixed(1)}
                    <span className="text-sm font-normal text-white/50 ml-1">km</span>
                  </p>
                </div>
                
                <div className="group rounded-xl bg-white/5 p-3.5 transition-all hover:bg-white/10">
                  <div className="flex items-center gap-2 mb-1.5">
                    <svg className="h-3.5 w-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-[10px] uppercase tracking-wider text-white/50 font-medium">Duration</p>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {route.estimatedDuration}
                    <span className="text-sm font-normal text-white/50 ml-1">min</span>
                  </p>
                </div>
                
                <div className="group rounded-xl bg-white/5 p-3.5 transition-all hover:bg-white/10">
                  <div className="flex items-center gap-2 mb-1.5">
                    <svg className="h-3.5 w-3.5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <p className="text-[10px] uppercase tracking-wider text-white/50 font-medium">Climb</p>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {route.elevationGain}
                    <span className="text-sm font-normal text-white/50 ml-1">m</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Story Beats with Enhanced Design */}
          {route.storyBeats.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5 backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)] font-medium">
                  Story Beats
                </p>
                <span className="text-[10px] text-white/40">
                  {route.storyBeats.length} moments
                </span>
              </div>
              
              <div className="space-y-2.5">
                {route.storyBeats.map((beat, i) => (
                  <div
                    key={i}
                    className="group flex items-center gap-4 rounded-lg bg-white/5 p-3 transition-all hover:bg-white/10"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`relative flex h-8 w-8 items-center justify-center rounded-lg ${
                        beat.type === "climb"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : beat.type === "drop"
                          ? "bg-blue-500/20 text-blue-400"
                          : beat.type === "sprint"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-green-500/20 text-green-400"
                      }`}>
                        {beat.type === "climb" && (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        )}
                        {beat.type === "sprint" && (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        )}
                        {beat.type === "drop" && (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-medium text-white group-hover:text-white/90 transition">
                          {beat.label}
                        </span>
                        <p className="text-[10px] text-white/40 mt-0.5 uppercase tracking-wider">
                          {beat.type}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-white/10 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            beat.type === "climb"
                              ? "bg-yellow-400"
                              : beat.type === "drop"
                              ? "bg-blue-400"
                              : "bg-red-400"
                          }`}
                          style={{ width: `${beat.progress * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-white/60 w-10 text-right">
                        {Math.round(beat.progress * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
