/**
 * Resolve the workout plan for a ride (Phase 3).
 *
 * Priority: explicit ?plan=<presetId> query param → coach-built class
 * stored locally for this classId → the historical default preset.
 * A "default" result means nothing was found locally; the caller should
 * try the durable remote store (Supabase classes table) and swap the
 * plan in if a record arrives before the ride starts.
 */

import {
  getPresetWorkout,
  PRESET_WORKOUTS,
  type WorkoutPlan,
} from "@/app/lib/workout-plan";
import { loadAgentClass } from "./agent-class-store";

export type RidePlanSource = "preset" | "agent-local" | "default";

export interface ResolvedRidePlan {
  plan: WorkoutPlan;
  source: RidePlanSource;
}

export function resolveRideWorkoutPlan(
  classId: string,
  searchParams: Pick<URLSearchParams, "get"> | null,
): ResolvedRidePlan {
  const presetId = searchParams?.get("plan");
  if (presetId) {
    const preset = getPresetWorkout(presetId);
    if (preset) return { plan: preset, source: "preset" };
  }

  const agentClass = loadAgentClass(classId);
  if (agentClass) return { plan: agentClass.plan, source: "agent-local" };

  return { plan: PRESET_WORKOUTS[1], source: "default" };
}
