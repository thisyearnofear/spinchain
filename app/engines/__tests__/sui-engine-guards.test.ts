// SuiEngine publication-policy guards — with the real (hard-denied) policy,
// no config can make the engine emit a personal-data transaction.

import { describe, it, expect, vi } from "vitest";
import { SuiEngine } from "../sui-engine";
import { EventBus } from "../event-bus";

function makeEngine(executeTransaction = vi.fn(async () => ({ digest: "0xdead" }))) {
  const bus = new EventBus();
  const engine = new SuiEngine(bus, {
    packageId: "0x1234",
    executeTransaction,
  });
  return { engine, executeTransaction };
}

describe("SuiEngine personal-data guards (real default policy)", () => {
  it("never invokes the executor even when a callback is configured", async () => {
    const { engine, executeTransaction } = makeEngine();

    await engine.start();
    expect(await engine.startSession("class-1", 2700)).toBeNull();
    expect(await engine.joinSession("sess-1")).toBeNull();
    expect(await engine.submitTelemetry(140, 200, 90)).toBe(false);
    engine.queueTelemetry(140, 200, 90);
    expect(await engine.flushTelemetry()).toBe(false);
    expect(
      await engine.anchorTelemetryBlob({
        classId: "class-1",
        blobId: "blob-1",
        epoch: 90,
        pointCount: 10,
      }),
    ).toBeNull();
    expect(await engine.closeSession()).toBe(false);

    expect(executeTransaction).not.toHaveBeenCalled();
    engine.dispose();
  });

  it("buffers nothing and starts no timers while denied", () => {
    const { engine } = makeEngine();
    engine.queueTelemetry(150, 210, 92);
    // Internal buffer stays empty — nothing is retained for a later flush.
    expect(
      (engine as unknown as { telemetryBuffer: unknown[] }).telemetryBuffer,
    ).toHaveLength(0);
    engine.dispose();
  });
});
