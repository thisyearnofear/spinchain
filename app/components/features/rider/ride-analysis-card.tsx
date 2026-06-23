"use client";

import { useState } from "react";
import { useRideAnalysis, type RideAnalysis } from "@/app/hooks/ai/use-ai-insights";
import { Sparkles, TrendingUp, TrendingDown, Minus, Loader2, Lightbulb } from "lucide-react";

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "improving") return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  if (trend === "declining") return <TrendingDown className="h-4 w-4 text-red-400" />;
  if (trend === "insufficient_data") return <span className="text-xs text-[color:var(--text-muted)]">—</span>;
  return <Minus className="h-4 w-4 text-[color:var(--text-muted)]" />;
}

export function RideAnalysisCard({ rideId }: { rideId?: string }) {
  const { analyze, isLoading, error } = useRideAnalysis();
  const [analysis, setAnalysis] = useState<RideAnalysis | null>(null);

  const handleAnalyze = async () => {
    const result = await analyze(rideId);
    if (result) setAnalysis(result);
  };

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 p-5 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-purple-400" />
        <h3 className="text-lg font-semibold">AI Ride Analysis</h3>
      </div>

      {!analysis && !isLoading && (
        <button
          onClick={handleAnalyze}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-500/20 px-4 py-2.5 text-sm font-medium text-purple-300 transition hover:bg-purple-500/30"
        >
          <Sparkles className="h-4 w-4" />
          Analyze my ride
        </button>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-[color:var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing your performance...
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={handleAnalyze} className="ml-2 underline">Try again</button>
        </div>
      )}

      {analysis && !isLoading && (
        <div className="space-y-4">
          <p className="text-sm text-[color:var(--text)]">{analysis.summary}</p>

          {analysis.improvements.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-emerald-400">Improvements</p>
              <ul className="space-y-1">
                {analysis.improvements.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[color:var(--text-muted)]">
                    <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.focusAreas.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-amber-400">Focus areas</p>
              <ul className="space-y-1">
                {analysis.focusAreas.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[color:var(--text-muted)]">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.tips.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-blue-400">
                <Lightbulb className="h-3.5 w-3.5" /> Tips
              </p>
              <ul className="space-y-1">
                {analysis.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[color:var(--text-muted)]">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-4 border-t border-[color:var(--border)] pt-3">
            <div className="flex items-center gap-1.5">
              <TrendIcon trend={analysis.comparison.effortTrend} />
              <span className="text-xs text-[color:var(--text-muted)]">Effort</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendIcon trend={analysis.comparison.powerTrend} />
              <span className="text-xs text-[color:var(--text-muted)]">Power</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendIcon trend={analysis.comparison.heartRateTrend} />
              <span className="text-xs text-[color:var(--text-muted)]">HR</span>
            </div>
          </div>

          <p className="border-t border-[color:var(--border)] pt-3 text-sm italic text-[color:var(--text-muted)]">
            "{analysis.encouragement}"
          </p>
        </div>
      )}
    </div>
  );
}
