"use client";

import { useState } from "react";
import { useTrainingPlan, type TrainingPlan } from "@/app/hooks/ai/use-ai-insights";
import { Calendar, Loader2, Sparkles, ChevronDown, ChevronRight, Dumbbell } from "lucide-react";

function intensityColor(intensity: string): string {
  switch (intensity) {
    case "easy": return "text-emerald-400";
    case "moderate": return "text-amber-400";
    case "hard": return "text-red-400";
    default: return "text-[color:var(--text-muted)]";
  }
}

export function TrainingPlanCard() {
  const { generate, isLoading, error } = useTrainingPlan();
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(1);
  const [weeks, setWeeks] = useState(4);

  const handleGenerate = async () => {
    const result = await generate(weeks);
    if (result) {
      setPlan(result);
      setExpandedWeek(1);
    }
  };

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 p-5 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <Calendar className="h-5 w-5 text-purple-400" />
        <h3 className="text-lg font-semibold">AI Training Plan</h3>
      </div>

      {!plan && !isLoading && (
        <div className="space-y-3">
          <p className="text-sm text-[color:var(--text-muted)]">
            Generate a personalized multi-week training plan based on your ride history and biometric profile.
          </p>
          <div className="flex items-center gap-3">
            <label className="text-sm text-[color:var(--text-muted)]">Weeks:</label>
            <select
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
              className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-sm outline-none focus:border-purple-500"
            >
              {[2, 4, 6, 8, 12].map((w) => (
                <option key={w} value={w}>{w} weeks</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleGenerate}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-500/20 px-4 py-2.5 text-sm font-medium text-purple-300 transition hover:bg-purple-500/30"
          >
            <Sparkles className="h-4 w-4" />
            Generate my plan
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-[color:var(--text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Creating your personalized plan...
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={handleGenerate} className="ml-2 underline">Try again</button>
        </div>
      )}

      {plan && !isLoading && (
        <div className="space-y-4">
          <div>
            <h4 className="text-base font-semibold text-purple-300">{plan.title}</h4>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">{plan.goal}</p>
            {plan.currentFitness && (
              <p className="mt-2 text-sm text-[color:var(--text)]">{plan.currentFitness}</p>
            )}
          </div>

          <div className="space-y-2">
            {plan.weeks.map((week) => (
              <div key={week.week} className="rounded-lg border border-[color:var(--border)]">
                <button
                  onClick={() => setExpandedWeek(expandedWeek === week.week ? null : week.week)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-[color:var(--surface)]/50"
                >
                  {expandedWeek === week.week ? (
                    <ChevronDown className="h-4 w-4 text-[color:var(--text-muted)]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-[color:var(--text-muted)]" />
                  )}
                  <span className="text-sm font-medium">Week {week.week}</span>
                  <span className="text-xs text-[color:var(--text-muted)]">{week.focus}</span>
                </button>

                {expandedWeek === week.week && (
                  <div className="space-y-1.5 px-3 pb-3">
                    {week.workouts.map((workout, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-md bg-[color:var(--surface)]/30 p-2.5">
                        <Dumbbell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-[color:var(--text-muted)]">{workout.day}</span>
                            <span className={`text-xs ${intensityColor(workout.intensity)}`}>{workout.intensity}</span>
                            <span className="text-xs text-[color:var(--text-muted)]">{workout.duration}min</span>
                          </div>
                          <p className="mt-0.5 text-sm font-medium">{workout.name}</p>
                          <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">{workout.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {plan.progression && (
            <div className="border-t border-[color:var(--border)] pt-3">
              <p className="text-xs font-medium uppercase tracking-wider text-purple-400">Progression</p>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">{plan.progression}</p>
            </div>
          )}

          {plan.tips.length > 0 && (
            <div className="border-t border-[color:var(--border)] pt-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-blue-400">Tips</p>
              <ul className="space-y-1">
                {plan.tips.map((tip, i) => (
                  <li key={i} className="text-sm text-[color:var(--text-muted)]">• {tip}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={handleGenerate}
            className="w-full rounded-lg border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface)]/50"
          >
            Regenerate plan
          </button>
        </div>
      )}
    </div>
  );
}
