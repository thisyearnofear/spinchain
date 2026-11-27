import { describe, expect, it } from "vitest";
import {
  CLOUD_ATMOSPHERE_KEYS,
  cloudAtmosphere,
  cloudChapter,
  cloudWarmth,
} from "../cloud-ride/cloud-atmosphere";
import { sequenceProgress } from "../cloud-ride/sequence";

describe("cloud atmosphere versions", () => {
  // The whole point of keying to progress rather than replacing the world: at
  // the start of a ride, nothing has changed. No grain, no horizon drift.
  it("opens on the shipped look", () => {
    const start = cloudAtmosphere(0);
    expect(start.air).toBe(0);
    expect(start.vista).toBe(0);
    expect(start.warmthBias).toBe(0);
    expect(start.chapter).toBe("Above the clouds");
  });

  it("is the shipped look for the whole opening stretch", () => {
    for (const p of [0, 0.02, 0.05, 0.065]) {
      expect(cloudAtmosphere(p).air).toBe(0);
      expect(cloudAtmosphere(p).vista).toBe(0);
    }
  });

  it("ends fully open, and holds there", () => {
    for (const p of [0.626, 0.8, 1, 1.5, Number.POSITIVE_INFINITY]) {
      const a = cloudAtmosphere(p);
      expect(a.air).toBe(1);
      expect(a.vista).toBe(1);
      expect(a.warmthBias).toBeCloseTo(0.2, 12);
    }
  });

  it("carries the authored chapter names, in order", () => {
    expect(cloudChapter(0.1)).toBe("Above the clouds");
    expect(cloudChapter(0.3)).toBe("The cloud cathedral");
    expect(cloudChapter(0.5)).toBe("Into the light");
    expect(cloudChapter(0.7)).toBe("One road. Open sky.");
  });

  // Converted from the authored 45s sequence: the sky has to reach each chapter
  // on the same station the architecture is standing on.
  it("puts its boundaries where the authored sequence does", () => {
    const boundaries = [9, 21, 29].map((s) => sequenceProgress(s));
    const keyStations = CLOUD_ATMOSPHERE_KEYS.map((k) => k.at);
    for (const b of boundaries) {
      expect(keyStations.some((k) => Math.abs(k - b) < 0.002)).toBe(true);
    }
  });

  it("opens out monotonically — air and drift only ever grow", () => {
    let air = -1;
    let vista = -1;
    for (let p = 0; p <= 1; p += 0.002) {
      const a = cloudAtmosphere(p);
      expect(a.air).toBeGreaterThanOrEqual(air - 1e-9);
      expect(a.vista).toBeGreaterThanOrEqual(vista - 1e-9);
      air = a.air;
      vista = a.vista;
    }
  });

  // Warmth is deliberately not monotone: the cathedral is cooler than the
  // opening, and the light arrives after it. That dip is the story.
  it("goes cool under the cathedral, then ends warmer than it started", () => {
    const opening = cloudAtmosphere(0).warmthBias;
    const cathedral = cloudAtmosphere(0.3).warmthBias;
    const end = cloudAtmosphere(1).warmthBias;
    expect(cathedral).toBeLessThan(opening);
    expect(end).toBeGreaterThan(opening);
  });

  // Smootherstep between keys: velocity is zero AT each key, so crossing a
  // chapter boundary cannot tick. Sampled either side of every key.
  it("has no seam at any chapter boundary", () => {
    const sample = (p: number) => cloudAtmosphere(p);
    const dt = 0.0005;
    for (const key of CLOUD_ATMOSPHERE_KEYS) {
      if (key.at <= 0 || key.at >= 1) continue;
      const before = sample(key.at - dt);
      const at = sample(key.at);
      const after = sample(key.at + dt);
      const inVel = (at.air - before.air) / dt;
      const outVel = (after.air - at.air) / dt;
      expect(Math.abs(inVel)).toBeLessThan(1e-3);
      expect(Math.abs(outVel)).toBeLessThan(1e-3);
      // And no jump in value either.
      expect(Math.abs(after.air - before.air)).toBeLessThan(1e-3);
      expect(Math.abs(after.vista - before.vista)).toBeLessThan(1e-3);
    }
  });

  it("stays inside its ranges for any input, including nonsense", () => {
    for (const p of [-5, -0.001, 0, 0.5, 1, 2, Number.NaN]) {
      const a = cloudAtmosphere(p);
      expect(a.air).toBeGreaterThanOrEqual(0);
      expect(a.air).toBeLessThanOrEqual(1);
      expect(a.vista).toBeGreaterThanOrEqual(0);
      expect(a.vista).toBeLessThanOrEqual(1);
      expect(a.warmthBias).toBeGreaterThanOrEqual(-1);
      expect(a.warmthBias).toBeLessThanOrEqual(1);
      expect(typeof a.chapter).toBe("string");
    }
  });

  it("folds the chapter into the warmth without leaving 0..1", () => {
    // Effort still modulates on top of the chapter bias, and the result is
    // always a legal warmth.
    expect(cloudWarmth(0, 0, 0.3, 0.25)).toBeCloseTo(0.3, 12);
    expect(cloudWarmth(1, 1, 0.3, 0.25)).toBeCloseTo(0.75, 12);
    expect(cloudWarmth(0.3, 1, 0.9, 0.5)).toBe(1);
    expect(cloudWarmth(0.3, -2, 0, 0.25)).toBeGreaterThanOrEqual(0);
  });
});
