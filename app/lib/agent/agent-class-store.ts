/**
 * Client-side handoff for coach-built classes (Phase 3).
 *
 * The agent builder writes the composed class here and the ride page
 * resolves its workout plan from it. This mirrors how the instructor
 * builder hands off drafts via localStorage (see use-class-draft.ts) and
 * carries the same caveat: it is the fast local path. The durable layer
 * is the Supabase classes table (app/lib/classes/class-store.ts) — this
 * store stays as the instant, offline-capable handoff.
 */

import { isClient } from "@/app/lib/utils";
import { parseWorkoutPlan } from "@/app/lib/classes/class-store";
import type { WorkoutPlan } from "@/app/lib/workout-plan";
import type { ClassGoal, CoachPersonality } from "./class-composer";

export interface StoredAgentClass {
  version: 1;
  classId: string;
  createdAt: number;
  name: string;
  goal: ClassGoal;
  personality: CoachPersonality;
  coachName: string;
  themeName: string;
  plan: WorkoutPlan;
}

const keyFor = (classId: string) => `spinchain:agent-class:${classId}`;
const KEY_PREFIX = "spinchain:agent-class:";

/** Cap on retained coach-built classes; oldest are evicted on save. */
const MAX_STORED_AGENT_CLASSES = 5;

export function saveAgentClass(stored: StoredAgentClass): void {
  if (!isClient()) return;
  try {
    window.localStorage.setItem(keyFor(stored.classId), JSON.stringify(stored));
    pruneAgentClasses();
  } catch {
    // Storage full or unavailable — the ride falls back to the preset plan.
  }
}

/** Evict oldest entries beyond the cap so the handoff store stays bounded. */
function pruneAgentClasses(): void {
  const entries: { key: string; createdAt: number }[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(KEY_PREFIX)) continue;
    let createdAt = 0;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) ?? "{}") as Partial<StoredAgentClass>;
      if (typeof parsed.createdAt === "number") createdAt = parsed.createdAt;
    } catch {
      // Corrupt entry — createdAt 0 sorts it first for eviction.
    }
    entries.push({ key, createdAt });
  }
  entries.sort((a, b) => a.createdAt - b.createdAt);
  for (const entry of entries.slice(0, Math.max(0, entries.length - MAX_STORED_AGENT_CLASSES))) {
    clearAgentClass(entry.key.slice(KEY_PREFIX.length));
  }
}

export function loadAgentClass(classId: string): StoredAgentClass | null {
  if (!isClient()) return null;
  try {
    const raw = window.localStorage.getItem(keyFor(classId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAgentClass>;
    if (parsed.version !== 1 || parsed.classId !== classId) return null;
    if (!parseWorkoutPlan(parsed.plan)) return null;
    return parsed as StoredAgentClass;
  } catch {
    return null;
  }
}

export function clearAgentClass(classId: string): void {
  if (!isClient()) return;
  window.localStorage.removeItem(keyFor(classId));
}
