import { describe, expect, it } from "vitest";
import {
  PRACTICE_WALL_DURATION_SEC,
  formatPracticeClock,
  practiceClockScale,
  toPracticeWallElapsed,
} from "@/app/lib/practice-demo";

describe("practice-demo", () => {
  it("compresses a 30-min class into ~45 wall seconds", () => {
    const classDurationSec = 30 * 60;
    expect(practiceClockScale(classDurationSec)).toBe(classDurationSec / PRACTICE_WALL_DURATION_SEC);
    expect(toPracticeWallElapsed(classDurationSec, classDurationSec)).toBe(
      PRACTICE_WALL_DURATION_SEC,
    );
  });

  it("maps mid-demo class elapsed back to wall clock", () => {
    const classDurationSec = 30 * 60; // scale = 40
    expect(toPracticeWallElapsed(800, classDurationSec)).toBe(20); // 800/40
  });

  it("never slows short classes below 1x", () => {
    expect(practiceClockScale(30)).toBe(1);
    expect(toPracticeWallElapsed(20, 30)).toBe(20);
  });

  it("formats demo clocks as MM:SS", () => {
    expect(formatPracticeClock(0)).toBe("00:00");
    expect(formatPracticeClock(45)).toBe("00:45");
    expect(formatPracticeClock(75)).toBe("01:15");
  });
});
