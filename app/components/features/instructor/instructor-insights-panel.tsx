"use client";

import { useState } from "react";
import { useInstructorInsights, type InstructorInsights } from "@/app/hooks/ai/use-ai-insights";
import { Brain, Loader2, AlertTriangle, TrendingUp, Users, Lightbulb } from "lucide-react";

function insightIcon(type: string) {
  switch (type) {
    case "improvement": return <TrendingUp className="h-4 w-4 text-emerald-400" />;
    case "concern": return <AlertTriangle className="h-4 w-4 text-amber-400" />;
    case "engagement": return <Users className="h-4 w-4 text-blue-400" />;
    default: return <Lightbulb className="h-4 w-4 text-purple-400" />;
  }
}

function healthColor(health: string) {
  switch (health) {
    case "healthy": return "text-emerald-400 bg-emerald-500/10";
    case "needs_attention": return "text-amber-400 bg-amber-500/10";
    case "at_risk": return "text-red-400 bg-red-500/10";
    default: return "text-[color:var(--text-muted)] bg-white/5";
  }
}

export function InstructorInsightsPanel() {
  const { getInsights, isLoading, error } = useInstructorInsights();
  const [insights, setInsights] = useState<InstructorInsights | null>(null);

  const handleGenerate = async () => {
    const result = await getInsights();
    if (result) setInsights(result);
  };

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 p-5 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <Brain className="h-5 w-5 text-purple-400" />
        <h3 className="text-lg font-semibold">AI Roster Insights</h3>
      </div>

      {!insights && !isLoading && (
        <button
          onClick={handleGenerate}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-500/20 px-4 py-2.5 text-sm font-medium text-purple-300 transition hover:bg-purple-500/30"
        >
          <Brain className="h-4 w-4" />
          Generate insights
        </button>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-[color:var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing your roster...
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={handleGenerate} className="ml-2 underline">Try again</button>
        </div>
      )}

      {insights && !isLoading && (
        <div className="space-y-4">
          <p className="text-sm text-[color:var(--text)]">{insights.summary}</p>

          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${healthColor(insights.rosterHealth)}`}>
              {insights.rosterHealth.replace("_", " ")}
            </span>
          </div>

          {insights.insights.length > 0 && (
            <div className="space-y-2">
              {insights.insights.map((insight, i) => (
                <div key={i} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
                  <div className="flex items-start gap-2">
                    {insightIcon(insight.type)}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{insight.rider}</p>
                      <p className="mt-0.5 text-sm text-[color:var(--text-muted)]">{insight.message}</p>
                      <p className="mt-1 text-xs text-blue-300">→ {insight.action}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {insights.recommendations.length > 0 && (
            <div className="border-t border-[color:var(--border)] pt-3">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-purple-400">Recommendations</p>
              <ul className="space-y-1">
                {insights.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[color:var(--text-muted)]">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-400" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
