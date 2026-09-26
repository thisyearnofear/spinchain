import { describe, it, expect } from "vitest";
import { isResumableRide } from "../ride-resume";

const session = { classId: "demo", duration: 45 }; // 45 minutes

describe("isResumableRide", () => {
  it("resumes a mid-ride interruption of the same class", () => {
    expect(isResumableRide(session, 600, "demo")).toBe(true);
  });

  it("does not resume a different class (cross-class clock bleed)", () => {
    expect(isResumableRide(session, 600, "agent-123")).toBe(false);
    expect(isResumableRide(session, 600, "practice-456")).toBe(false);
  });

  it("does not resume a finished clock (elapsed at or past duration)", () => {
    expect(isResumableRide(session, 2700, "demo")).toBe(false); // exactly done
    expect(isResumableRide(session, 9999, "demo")).toBe(false); // past the cap
  });

  it("does not resume without a session or without elapsed time", () => {
    expect(isResumableRide(null, 600, "demo")).toBe(false);
    expect(isResumableRide(session, 0, "demo")).toBe(false);
    expect(isResumableRide(session, NaN, "demo")).toBe(false);
  });

  it("treats a one-second-old ride as fresh, not an interruption", () => {
    // elapsedTime is in seconds; a ride that just started has nothing
    // worth resuming, but it is still strictly mid-ride.
    expect(isResumableRide(session, 1, "demo")).toBe(true);
  });
});
