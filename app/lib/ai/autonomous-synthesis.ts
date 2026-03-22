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
  const prompt = `
    You are an expert Spin Class Designer. Generate a structured workout plan for a ${req.durationMinutes}-minute session.
    Goal: ${req.goal}
    Instructor Personality: ${req.personality}
    Visual Theme: ${req.theme}

    Output a JSON object following this structure:
    {
      "name": "Creative name for the class",
      "description": "Short engaging description",
      "difficulty": "easy" | "moderate" | "hard",
      "intervals": [
        {
          "phase": "warmup" | "endurance" | "interval" | "sprint" | "recovery" | "cooldown",
          "durationSeconds": number,
          "targetRpm": [min, max],
          "coachCue": "A motivational cue in the instructor's personality",
          "musicEnergy": 0.0 - 1.0
        }
      ],
      "tags": ["tag1", "tag2"]
    }

    Constraints:
    - Intervals must sum exactly to ${req.durationMinutes * 60} seconds.
    - Match the ${req.personality} coaching style in the coachCues.
    - Ensure a logical flow (warmup -> work -> cooldown).
  `;

  try {
    // In a real implementation, we would call Venice/Gemini here.
    // For the demo/prototype, we simulate the AI response with a structured template.
    console.log("[Synthesis] Generating plan for:", req.goal);
    
    // Simulate AI thinking time
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock response that follows the requested structure
    const plan: WorkoutPlan = {
      id: `synth-${Date.now()}`,
      name: `${req.theme.toUpperCase()} ${req.goal.split(' ')[0]} Attack`,
      description: `An autonomous curated experience focusing on ${req.goal}.`,
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

    return plan;
  } catch (error) {
    console.error("Synthesis failed:", error);
    throw error;
  }
}
