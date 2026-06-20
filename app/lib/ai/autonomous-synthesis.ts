/**
 * Autonomous Synthesis Service
 * 
 * Uses AI to curate and design full spin class experiences.
 * - Generates structured intervals
 * - Designs terrain/story beats
 * - Recommends music vibes
 */

import { WorkoutPlan, WorkoutInterval, IntervalPhase } from "@/app/lib/workout-plan";

export interface SynthesisRequest {
  goal: string; // e.g. "Burn 500 calories", "High intensity sprint work"
  durationMinutes: number;
  personality: string;
  theme: "neon" | "alpine" | "mars" | "anime" | "rainbow";
}

export async function synthesizeWorkoutPlan(req: SynthesisRequest): Promise<WorkoutPlan> {
  console.log("[Synthesis] Generating plan for:", req.goal);

  try {
    const response = await fetch("/api/ai/synthesize-workout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal: req.goal,
        durationMinutes: req.durationMinutes,
        personality: req.personality,
        theme: req.theme,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(err.message || `Synthesis failed (${response.status})`);
    }

    const plan = await response.json() as WorkoutPlan;
    return plan;
  } catch (error) {
    console.error("[Synthesis] API call failed, falling back to template:", error);

    return fallbackTemplate(req);
  }
}

function fallbackTemplate(req: SynthesisRequest): WorkoutPlan {
  return {
    id: `synth-${Date.now()}`,
    name: `${req.theme.toUpperCase()} ${req.goal.split(' ')[0]} Attack`,
    description: `An AI-curated experience focusing on ${req.goal}.`,
    difficulty: req.durationMinutes > 30 ? "hard" : "moderate",
    totalDuration: req.durationMinutes * 60,
    tags: ["ai-curated", req.theme, "performance"],
    intervals: [
      { phase: "warmup", durationSeconds: 300, targetRpm: [80, 90], coachCue: "Let's get those legs moving. Find the rhythm.", musicEnergy: 0.3 },
      { phase: "endurance", durationSeconds: 600, targetRpm: [90, 100], coachCue: "Settle into the pace. This is your foundation.", musicEnergy: 0.6 },
      { phase: "sprint", durationSeconds: 60, targetRpm: [110, 130], coachCue: "ALL OUT! Empty the tank!", musicEnergy: 1.0 },
      { phase: "recovery", durationSeconds: 120, targetRpm: [80, 85], coachCue: "Breathe. You earned this reset.", musicEnergy: 0.2 },
      { phase: "cooldown", durationSeconds: 120, targetRpm: [70, 80], coachCue: "Great work today. Respect the effort.", musicEnergy: 0.1 }
    ]
  };
}
