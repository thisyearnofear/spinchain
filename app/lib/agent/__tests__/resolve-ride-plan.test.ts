import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PRESET_WORKOUTS } from "@/app/lib/workout-plan";
import { composeClass } from "../class-composer";
import { loadAgentClass, saveAgentClass } from "../agent-class-store";
import { resolveRideWorkoutPlan } from "../resolve-ride-plan";

// Node test environment: stub just enough window.localStorage for the
// store's isClient() guard.
const backing = new Map<string, string>();

beforeEach(() => {
  backing.clear();
  (globalThis as Record<string, unknown>).window = {
    localStorage: {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => void backing.set(key, String(value)),
      removeItem: (key: string) => void backing.delete(key),
    },
  };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

function params(entries: Record<string, string>): Pick<URLSearchParams, "get"> {
  return new URLSearchParams(entries);
}

describe("agent class store", () => {
  it("round-trips a saved class", () => {
    const composed = composeClass({ goal: "hiit", durationMinutes: 30, personality: "zen" });
    saveAgentClass({
      version: 1,
      classId: "agent-1",
      createdAt: 1000,
      name: composed.name,
      goal: composed.goal,
      personality: composed.personality,
      coachName: composed.coachName,
      themeName: composed.themeName,
      plan: composed.plan,
    });
    expect(loadAgentClass("agent-1")?.plan).toEqual(composed.plan);
  });

  it("rejects corrupt or foreign entries", () => {
    backing.set("spinchain:agent-class:agent-2", "not json");
    expect(loadAgentClass("agent-2")).toBeNull();

    backing.set(
      "spinchain:agent-class:agent-3",
      JSON.stringify({ version: 1, classId: "agent-3", plan: { id: "x", intervals: [] } }),
    );
    expect(loadAgentClass("agent-3")).toBeNull();

    expect(loadAgentClass("agent-missing")).toBeNull();
  });
});

describe("resolveRideWorkoutPlan", () => {
  it("prefers an explicit ?plan= preset param", () => {
    const plan = resolveRideWorkoutPlan("any-class", params({ plan: "climb-45" }));
    expect(plan.id).toBe("climb-45");
  });

  it("uses the coach-built plan stored for the classId", () => {
    const composed = composeClass({ goal: "climb", durationMinutes: 20, personality: "data" });
    saveAgentClass({
      version: 1,
      classId: "agent-42",
      createdAt: 1000,
      name: composed.name,
      goal: composed.goal,
      personality: composed.personality,
      coachName: composed.coachName,
      themeName: composed.themeName,
      plan: composed.plan,
    });
    const plan = resolveRideWorkoutPlan("agent-42", params({}));
    expect(plan.id).toBe(composed.plan.id);
    expect(plan.totalDuration).toBe(20 * 60);
  });

  it("falls back to the historical default preset", () => {
    const plan = resolveRideWorkoutPlan("no-such-class", params({}));
    expect(plan.id).toBe(PRESET_WORKOUTS[1].id);
  });

  it("ignores unknown preset ids and keeps resolving", () => {
    const plan = resolveRideWorkoutPlan("no-such-class", params({ plan: "nope-99" }));
    expect(plan.id).toBe(PRESET_WORKOUTS[1].id);
  });

  it("falls back when no window (server render)", () => {
    delete (globalThis as Record<string, unknown>).window;
    const plan = resolveRideWorkoutPlan("agent-42", null);
    expect(plan.id).toBe(PRESET_WORKOUTS[1].id);
  });
});
