// @vitest-environment jsdom
// Oracle/coordinator stop — no automatic proving, no telemetry upload.

import { describe, it, expect, vi, afterEach } from "vitest";

const proveSpy = vi.hoisted(() => vi.fn());
vi.mock("@/app/lib/zk/prover", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/lib/zk/prover")>();
  return {
    ...actual,
    getProver: () => ({
      proveEffortThreshold: proveSpy,
      proveHeartRateAboveThreshold: proveSpy,
    }),
  };
});

const storeTelemetrySpy = vi.hoisted(() => vi.fn(async () => null));
vi.mock("@/app/lib/walrus/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/lib/walrus/client")>();
  return {
    ...actual,
    getAssetManager: () => ({ storeTelemetry: storeTelemetrySpy }),
  };
});

const getLocalOracleSpy = vi.hoisted(() => vi.fn());
vi.mock("@/app/lib/zk/oracle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/lib/zk/oracle")>();
  return { ...actual, getLocalOracle: getLocalOracleSpy };
});

import { LocalOracle } from "@/app/lib/zk/oracle";
import { RideCoordinator } from "@/app/engines/coordinator";

afterEach(() => {
  vi.unstubAllEnvs();
  proveSpy.mockClear();
  storeTelemetrySpy.mockClear();
  getLocalOracleSpy.mockClear();
});

describe("LocalOracle.endSession — stop only", () => {
  it("stops recording without invoking the prover or a telemetry upload", async () => {
    const oracle = new LocalOracle();
    oracle.startSession({
      classId: "c1",
      riderId: "r1",
      startTime: Date.now(),
      targetHeartRate: 150,
      minDuration: 300,
    });
    oracle.addTelemetry({ timestamp: Date.now(), heartRate: 140, power: 180, cadence: 80 });

    const result = await oracle.endSession();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/disabled/i);
    expect(proveSpy).not.toHaveBeenCalled();
    expect(storeTelemetrySpy).not.toHaveBeenCalled();
  });
});

describe("RideCoordinator — default policy", () => {
  it("start() never instantiates the local oracle", async () => {
    const coordinator = new RideCoordinator();
    await coordinator.start({
      classId: "c1",
      classData: null,
      deviceType: "simulator" as never,
      performanceTier: "low" as never,
      isPracticeMode: true,
      walletConnected: false,
      rewardMode: "zk-batch",
      coachingConfig: {
        agentName: "Coach",
        personality: "data",
        workoutPlan: null,
        aiActive: false,
      } as never,
    });
    expect(getLocalOracleSpy).not.toHaveBeenCalled();
    await coordinator.stop();
    expect(proveSpy).not.toHaveBeenCalled();
    expect(storeTelemetrySpy).not.toHaveBeenCalled();
    coordinator.dispose();
  });
});
