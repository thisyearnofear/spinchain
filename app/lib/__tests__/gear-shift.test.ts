import { beforeEach, describe, expect, it, vi } from "vitest";
import { shiftGear, TOTAL_GEARS } from "../gear-shift";
import { useTelemetryStore } from "@/app/stores/telemetry-store";

/**
 * gear-shift is the single path every shifter (keyboard arrows, on-screen
 * buttons) takes to the telemetry store and the ride engine. The property
 * that matters: the store and the engine can never disagree, and gear can
 * never leave [1, TOTAL_GEARS].
 */

describe("shiftGear", () => {
  beforeEach(() => {
    useTelemetryStore.setState({ currentGear: 10 });
  });

  it("moves the gear by delta and reports the new gear", () => {
    expect(shiftGear(1)).toBe(11);
    expect(useTelemetryStore.getState().currentGear).toBe(11);
    expect(shiftGear(-1)).toBe(10);
    expect(useTelemetryStore.getState().currentGear).toBe(10);
  });

  it("clamps at the top and bottom of the cassette", () => {
    useTelemetryStore.setState({ currentGear: TOTAL_GEARS });
    expect(shiftGear(1)).toBe(TOTAL_GEARS);
    useTelemetryStore.setState({ currentGear: 1 });
    expect(shiftGear(-1)).toBe(1);
    expect(useTelemetryStore.getState().currentGear).toBe(1);
  });

  it("clamps multi-step deltas, not just ±1", () => {
    expect(shiftGear(100)).toBe(TOTAL_GEARS);
    expect(shiftGear(-100)).toBe(1);
  });

  it("syncs the engine only when the gear actually changes", () => {
    const sync = vi.fn();
    shiftGear(1, sync);
    expect(sync).toHaveBeenCalledWith(11);

    sync.mockClear();
    useTelemetryStore.setState({ currentGear: TOTAL_GEARS });
    shiftGear(1, sync);
    expect(sync).not.toHaveBeenCalled();
  });

  it("updates the store even without an engine callback", () => {
    shiftGear(-1);
    expect(useTelemetryStore.getState().currentGear).toBe(9);
  });
});
