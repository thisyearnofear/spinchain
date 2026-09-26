import { describe, it, expect, beforeEach, vi } from "vitest";

const retrieveJSON = vi.fn();
vi.mock("../client", () => ({
  getWalrusClient: () => ({ retrieveJSON }),
}));

import {
  createInitialMemory,
  parseCoachMemory,
  updateMemoryAfterRide,
  loadCoachMemory,
  type CoachMemory,
} from "../coach-memory";

// node env: stub browser storage used by the persistence path
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).window = globalThis;
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

describe("createInitialMemory", () => {
  it("creates a valid empty memory", () => {
    const m = createInitialMemory("0xabc", "Coach:zen");
    expect(m.version).toBe(1);
    expect(m.rides).toBe(0);
    expect(m.lastRide).toBeNull();
    expect(m.bestAvgPower).toBe(0);
    expect(m.notes).toEqual([]);
    expect(parseCoachMemory(m)).not.toBeNull();
  });
});

describe("parseCoachMemory", () => {
  it("accepts a valid memory", () => {
    const m = updateMemoryAfterRide(
      createInitialMemory("0xabc", "Coach:data"),
      { avgPower: 180, durationSec: 2700, completed: true },
      undefined,
      1000,
    );
    expect(parseCoachMemory(m)).toEqual(m);
  });

  it("rejects non-objects and wrong versions", () => {
    expect(parseCoachMemory(null)).toBeNull();
    expect(parseCoachMemory("nope")).toBeNull();
    expect(parseCoachMemory({ version: 2 })).toBeNull();
  });

  it("rejects malformed fields", () => {
    const base = createInitialMemory("0xabc", "Coach:data");
    expect(parseCoachMemory({ ...base, riderId: "" })).toBeNull();
    expect(parseCoachMemory({ ...base, rides: -1 })).toBeNull();
    expect(parseCoachMemory({ ...base, notes: ["ok", 42] })).toBeNull();
    expect(parseCoachMemory({ ...base, lastRide: { avgPower: "high" } })).toBeNull();
  });
});

describe("loadCoachMemory cache merge", () => {
  const RIDER = "0xabc";
  const COACH = "Coach:zen";
  const pointerKey = `spinchain:coach-memory:${RIDER}:${COACH}`;
  const cacheKey = `${pointerKey}:cache`;

  function memoryWithRides(n: number): CoachMemory {
    let m = createInitialMemory(RIDER, COACH);
    for (let i = 0; i < n; i++) {
      m = updateMemoryAfterRide(m, { avgPower: 100 + i, durationSec: 60, completed: true });
    }
    return m;
  }

  function seedCache(memory: CoachMemory, pendingSync: boolean): void {
    localStorage.setItem(cacheKey, JSON.stringify({ memory, pendingSync, updatedAt: Date.now() }));
  }

  beforeEach(() => {
    localStorage.clear();
    retrieveJSON.mockReset();
    localStorage.setItem(pointerKey, "blob-1");
  });

  it("keeps a newer pendingSync cache when the fetched blob is older", async () => {
    const newer = memoryWithRides(3);
    seedCache(newer, true);
    retrieveJSON.mockResolvedValue({ success: true, data: memoryWithRides(2) });

    const loaded = await loadCoachMemory(RIDER, COACH);
    expect(loaded?.rides).toBe(3);

    const cached = JSON.parse(localStorage.getItem(cacheKey)!);
    expect(cached.memory.rides).toBe(3);
    expect(cached.pendingSync).toBe(true);
  });

  it("overwrites cache when the fetched blob is newer", async () => {
    seedCache(memoryWithRides(2), false);
    retrieveJSON.mockResolvedValue({ success: true, data: memoryWithRides(5) });

    const loaded = await loadCoachMemory(RIDER, COACH);
    expect(loaded?.rides).toBe(5);

    const cached = JSON.parse(localStorage.getItem(cacheKey)!);
    expect(cached.memory.rides).toBe(5);
    expect(cached.pendingSync).toBe(false);
  });
});

describe("updateMemoryAfterRide", () => {
  it("increments rides and records the summary", () => {
    const m0 = createInitialMemory("0xabc", "Coach:data");
    const m1 = updateMemoryAfterRide(
      m0,
      { avgPower: 180, durationSec: 2700, completed: true },
      undefined,
      5000,
    );
    expect(m1.rides).toBe(1);
    expect(m1.lastRideAt).toBe(5000);
    expect(m1.lastRide).toEqual({ avgPower: 180, durationSec: 2700, completed: true });
    expect(m1.bestAvgPower).toBe(180);
    // original untouched (pure)
    expect(m0.rides).toBe(0);
  });

  it("tracks best average power as a max, not last", () => {
    let m = createInitialMemory("0xabc", "Coach:data");
    m = updateMemoryAfterRide(m, { avgPower: 200, durationSec: 100, completed: true });
    m = updateMemoryAfterRide(m, { avgPower: 150, durationSec: 100, completed: true });
    expect(m.bestAvgPower).toBe(200);
    expect(m.lastRide?.avgPower).toBe(150);
  });

  it("prepends notes, dedupes consecutive repeats, caps at 5", () => {
    let m = createInitialMemory("0xabc", "Coach:data");
    const ride = { avgPower: 100, durationSec: 60, completed: true };
    m = updateMemoryAfterRide(m, ride, "note-a");
    m = updateMemoryAfterRide(m, ride, "note-a"); // consecutive dupe ignored
    expect(m.notes).toEqual(["note-a"]);
    for (let i = 0; i < 6; i++) m = updateMemoryAfterRide(m, ride, `note-${i}`);
    expect(m.notes).toHaveLength(5);
    expect(m.notes[0]).toBe("note-5");
  });
});
