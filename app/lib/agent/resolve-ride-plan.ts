/**
 * Resolve the workout plan for a ride (Phase 3).
 *
 * Priority: explicit ?plan=<presetId> query param → coach-built class
 * stored for this classId → the historical default preset. Before
 * Phase 3 the ride page hardcoded PRESET_WORKOUTS[1] for every class;
 * the plan now travels with the class.
 */

import {
  getPresetWorkout,
  PRESET_WORKOUTS,
  type WorkoutPlan,
} from "@/app/lib/workout-plan";
import { loadAgentClass } from "./agent-class-store";

export function resolveRideWorkoutPlan(
  classId: string,
  searchParams: Pick<URLSearchParams, "get"> | null,
): WorkoutPlan {
  const presetId = searchParams?.get("plan");
  if (presetId) {
    const preset = getPresetWorkout(presetId);
    if (preset) return preset;
  }

  const agentClass = loadAgentClass(classId);
  if (agentClass) return agentClass.plan;

  return PRESET_WORKOUTS[1];
}
