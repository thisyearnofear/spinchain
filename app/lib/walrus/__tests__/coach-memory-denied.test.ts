// Coach memory under the real (hard-denied) publication policy:
// saves go to the local cache only, loads prefer fresh local memory, and no
// Walrus network call is ever made.

import { describe, it, expect, beforeEach, vi } from "vitest";

const retrieveJSON = vi.fn();
const storeJSON = vi.fn();
vi.mock("../client", () => ({
  getWalrusClient: () => ({ retrieveJSON, storeJSON }),
}));

import {
  createInitialMemory,
  updateMemoryAfterRide,
  loadCoachMemory,
  saveCoachMemory,
  type CoachMemory,
} from "../coach-memory";

// node env: stub browser storage
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).window = globalThis;
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
};

const RIDER = "0xabc";
const COACH = "Coach:zen";

function memoryWithRides(n: number): CoachMemory {
  let m = createInitialMemory(RIDER, COACH);
  for (let i = 0; i < n; i++) {
    m = updateMemoryAfterRide(m, { avgPower: 100 + i, durationSec: 60, completed: true });
  }
  return m;
}

describe("coach memory — publication denied (real policy)", () => {
  beforeEach(() => {
    localStorage.clear();
    retrieveJSON.mockReset();
    storeJSON.mockReset();
  });

  it("two sequential rides persist via local cache with no network calls", async () => {
    const r1 = await saveCoachMemory(memoryWithRides(1));
    expect(r1).toEqual({ persisted: "local", blobId: null });
    expect(storeJSON).not.toHaveBeenCalled();

    const r2 = await saveCoachMemory(memoryWithRides(2));
    expect(r2).toEqual({ persisted: "local", blobId: null });
    expect(storeJSON).not.toHaveBeenCalled();

    const loaded = await loadCoachMemory(RIDER, COACH);
    expect(loaded?.rides).toBe(2);
    expect(retrieveJSON).not.toHaveBeenCalled();
  });

  it("fresh local memory wins over an older public blob pointer", async () => {
    // Simulate a legacy pointer left behind from before the boundary.
    localStorage.setItem(`spinchain:coach-memory:${RIDER}:${COACH}`, "old-blob");
    await saveCoachMemory(memoryWithRides(3));

    const loaded = await loadCoachMemory(RIDER, COACH);
    expect(loaded?.rides).toBe(3);
    expect(retrieveJSON).not.toHaveBeenCalled();
  });

  it("returns null when nothing is cached locally", async () => {
    expect(await loadCoachMemory("0xdef", "Coach:data")).toBeNull();
    expect(retrieveJSON).not.toHaveBeenCalled();
  });
});
