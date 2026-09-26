/**
 * Durable class storage (Supabase `classes` table).
 *
 * The class object is the shared contract between the agentic composer and
 * the instructor builder. localStorage remains the instant, offline-capable
 * path (see app/lib/agent/agent-class-store.ts); this module is the durable
 * layer that survives browsers and devices. Every caller must degrade to
 * the local path when Supabase is unconfigured or unreachable.
 */

import { getBrowserClient, isSupabaseConfigured } from "@/app/lib/supabase/client";
import type { WorkoutPlan } from "@/app/lib/workout-plan";

export interface ClassRecord {
  id: string;
  source: "agentic" | "instructor";
  author: string;
  name: string;
  description?: string;
  goal?: string;
  personality?: string;
  coachName?: string;
  themeName?: string;
  durationMinutes?: number;
  plan: WorkoutPlan;
  route?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/** Structural validation for a WorkoutPlan from any store (local or remote). */
export function parseWorkoutPlan(raw: unknown): WorkoutPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<WorkoutPlan>;
  if (
    typeof candidate.id !== "string" ||
    !Array.isArray(candidate.intervals) ||
    candidate.intervals.length === 0
  ) {
    return null;
  }
  const intervalsOk = candidate.intervals.every(
    (interval) =>
      interval &&
      typeof interval.durationSeconds === "number" &&
      interval.durationSeconds > 0 &&
      typeof interval.phase === "string",
  );
  return intervalsOk ? (candidate as WorkoutPlan) : null;
}

/**
 * Persist a class record. Best-effort: resolves false when Supabase is
 * unconfigured or the write fails; callers keep their local fallback.
 */
export async function saveClassRemote(record: ClassRecord): Promise<boolean> {
  if (!isSupabaseConfigured() || typeof window === "undefined") return false;
  const client = getBrowserClient();
  if (!client) return false;

  try {
    const { error } = await client.from("classes").upsert({
      id: record.id,
      source: record.source,
      author: record.author,
      name: record.name,
      description: record.description ?? null,
      goal: record.goal ?? null,
      personality: record.personality ?? null,
      coach_name: record.coachName ?? null,
      theme_name: record.themeName ?? null,
      duration_minutes: record.durationMinutes ?? null,
      plan: record.plan,
      route: record.route ?? null,
      metadata: record.metadata ?? null,
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn("[classes] remote save failed; local copy still usable", err);
    return false;
  }
}

/**
 * Load a class's workout plan by id. Returns null when unconfigured,
 * unreachable, missing, or malformed — callers fall back gracefully.
 */
export async function loadClassPlanRemote(classId: string): Promise<WorkoutPlan | null> {
  if (!isSupabaseConfigured() || typeof window === "undefined") return null;
  const client = getBrowserClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from("classes")
      .select("plan")
      .eq("id", classId)
      .maybeSingle();
    if (error) throw error;
    return parseWorkoutPlan(data?.plan);
  } catch (err) {
    console.warn("[classes] remote load failed; using local fallback", err);
    return null;
  }
}
