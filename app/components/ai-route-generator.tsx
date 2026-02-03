/**
 * AI Route Generator Component
 * Natural language interface for route creation - integrates into existing route builder
 */

"use client";

import { useState } from "react";
import { useAIRoute } from "../hooks/use-ai-route";
import type { RouteGenerationParams } from "../lib/ai-service";

type AIRouteGeneratorProps = {
  onRouteGenerated?: (gpxSummary: any) => void;
  className?: string;
};

export function AIRouteGenerator({
  onRouteGenerated,
  className = "",
}: AIRouteGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(45);
  const [difficulty, setDifficulty] = useState<"easy" | "moderate" | "hard">("moderate");
  
  const { isGenerating, error, route, gpxSummary, generateRoute, exportGPX, clearRoute } =
    useAIRoute();

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    try {
      const params: RouteGenerationParams = {
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

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Prompt Input */}
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wider text-[color:var(--muted)]">
          Describe Your Route
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., 'A coastal climb with ocean views starting from Santa Monica' or 'Fast urban sprint through downtown with minimal stops'"
          className="w-full h-24 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          disabled={isGenerating}
        />
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
      <div className="flex gap-2">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="flex-1 rounded-lg bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              Generating...
            </span>
          ) : (
            "Generate Route"
          )}
        </button>

        {route && (
          <>
            <button
              onClick={handleExport}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Export GPX
            </button>
            <button
              onClick={clearRoute}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Clear
            </button>
          </>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Route Summary */}
      {route && gpxSummary && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-2">
              Generated Route
            </p>
            <h3 className="text-lg font-semibold text-white mb-1">{route.name}</h3>
            <p className="text-sm text-white/70 mb-4">{route.description}</p>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/50">Distance</p>
                <p className="text-lg font-semibold text-white">
                  {route.estimatedDistance.toFixed(1)}{" "}
                  <span className="text-xs font-normal text-white/50">km</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/50">Duration</p>
                <p className="text-lg font-semibold text-white">
                  {route.estimatedDuration}{" "}
                  <span className="text-xs font-normal text-white/50">min</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/50">Climb</p>
                <p className="text-lg font-semibold text-white">
                  {route.elevationGain}{" "}
                  <span className="text-xs font-normal text-white/50">m</span>
                </p>
              </div>
            </div>
          </div>

          {route.storyBeats.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wider text-[color:var(--muted)] mb-3">
                Story Beats
              </p>
              <div className="space-y-2">
                {route.storyBeats.map((beat, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          beat.type === "climb"
                            ? "bg-yellow-400"
                            : beat.type === "drop"
                            ? "bg-blue-400"
                            : "bg-red-400"
                        }`}
                      />
                      <span className="text-white/80">{beat.label}</span>
                    </div>
                    <span className="text-xs text-white/60">
                      {Math.round(beat.progress * 100)}%
                    </span>
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
