import { describe, it, expect } from "vitest";
import {
  createInitialMemory,
  parseCoachMemory,
  updateMemoryAfterRide,
} from "../coach-memory";

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
