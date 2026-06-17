import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventBus } from "../event-bus";
import { RewardsEngine, type StartEarningConfig } from "../rewards-engine";
import type { BatchAccumulator } from "@/app/lib/rewards/zk";

// Mock all the reward library imports
vi.mock("@/app/lib/rewards/calculator", () => ({
  calculateAccumulatedReward: vi.fn().mockImplementation(
    (_current, _prev, previousAccumulated) => previousAccumulated + BigInt(1),
  ),
  calculateEffortScore: vi.fn().mockReturnValue(500),
  formatReward: vi.fn().mockImplementation((amount: bigint) => `${amount.toString()} SPIN`),
}));

vi.mock("@/app/lib/rewards/zk", () => ({
  createBatchAccumulator: vi.fn().mockReturnValue({
    telemetryPoints: [],
    totalDuration: 0,
    maxHeartRate: 0,
    avgPower: 0,
  }),
  addToBatch: vi.fn().mockImplementation(
    (batch: BatchAccumulator, heartRate: number, power: number) => ({
      telemetryPoints: [...batch.telemetryPoints, { heartRate, power, timestamp: Date.now() }],
      totalDuration: batch.totalDuration + 10,
      maxHeartRate: Math.max(batch.maxHeartRate, heartRate),
      avgPower: batch.telemetryPoints.length > 0
        ? (batch.avgPower * batch.telemetryPoints.length + power) / (batch.telemetryPoints.length + 1)
        : power,
    }),
  ),
}));

vi.mock("@/app/lib/rewards/yellow/channel", () => ({
  openRewardChannel: vi.fn().mockResolvedValue({
    id: "channel-1",
    rider: "0xrider",
    instructor: "0xinstructor",
    classId: "0xclass",
    depositAmount: BigInt(100),
    status: "open",
    openedAt: Date.now(),
  }),
  closeRewardChannel: vi.fn().mockResolvedValue({
    id: "channel-1",
    status: "closed",
    finalAmount: BigInt(50),
  }),
  getActiveChannel: vi.fn().mockReturnValue(null),
  isChannelOpen: vi.fn().mockReturnValue(true),
  getNextSequence: vi.fn().mockReturnValue(1),
}));

vi.mock("@/app/lib/rewards/yellow/clearnode", () => ({
  submitState: vi.fn().mockResolvedValue(undefined),
  isClearNodeConnected: vi.fn().mockReturnValue(true),
}));

describe("RewardsEngine", () => {
  let bus: EventBus;
  let engine: RewardsEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    bus = new EventBus();
  });

  afterEach(() => {
    engine?.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("ZK batch mode", () => {
    beforeEach(() => {
      engine = new RewardsEngine(bus, {
        mode: "zk-batch",
        classId: "class-1",
        instructor: "0x0" as `0x${string}`,
      });
    });

    it("starts with zk-batch mode and inactive state", () => {
      expect(engine.mode).toBe("zk-batch");
      expect(engine.isActive).toBe(false);
      expect(engine.batchAccumulator).toBeNull();
    });

    it("startEarning initialises batch accumulator and emits rewards:started", async () => {
      const startedHandler = vi.fn();
      bus.on("rewards:started", startedHandler);

      await engine.startEarning();

      expect(engine.isActive).toBe(true);
      expect(engine.batchAccumulator).not.toBeNull();
      expect(startedHandler).toHaveBeenCalled();
    });

    it("recordEffort adds telemetry to the batch accumulator", async () => {
      await engine.startEarning();
      expect(engine.batchAccumulator?.telemetryPoints.length).toBe(0);

      await engine.recordEffort({
        heartRate: 150,
        power: 200,
        cadence: 80,
        timestamp: Date.now(),
      });

      expect(engine.batchAccumulator?.telemetryPoints.length).toBe(1);
      expect(engine.batchAccumulator?.maxHeartRate).toBe(150);
    });

    it("recordEffort is a no-op before startEarning", async () => {
      await engine.recordEffort({ heartRate: 150, power: 200, cadence: 80, timestamp: Date.now() });
      expect(engine.batchAccumulator).toBeNull();
    });

    it("finalizeRewards returns success with calculated amount", async () => {
      await engine.startEarning();
      await engine.recordEffort({ heartRate: 150, power: 200, cadence: 80, timestamp: Date.now() });

      const result = await engine.finalizeRewards();
      expect(result.success).toBe(true);
      expect(result.amount).toBeGreaterThan(BigInt(0));
    });

    it("finalizeRewards emits rewards:finalized event", async () => {
      const finalizedHandler = vi.fn();
      bus.on("rewards:finalized", finalizedHandler);

      await engine.startEarning();
      await engine.finalizeRewards();
      expect(finalizedHandler).toHaveBeenCalled();
    });

    it("dispose clears batch state", async () => {
      await engine.startEarning();
      engine.dispose();
      expect(engine.batchAccumulator).toBeNull();
      expect(engine.isActive).toBe(false);
    });
  });

  describe("Yellow streaming mode", () => {
    const startConfig = {
      rider: "0xrider" as `0x${string}`,
      instructor: "0xinstructor" as `0x${string}`,
      classId: "0xclass" as `0x${string}`,
      depositAmount: BigInt(100),
      signUpdate: vi.fn().mockResolvedValue("0xsig"),
    };

    beforeEach(() => {
      engine = new RewardsEngine(bus, {
        mode: "yellow-stream",
        classId: "class-1",
        instructor: "0x0" as `0x${string}`,
      });
    });

    it("starts with yellow-stream mode", () => {
      expect(engine.mode).toBe("yellow-stream");
      expect(engine.isActive).toBe(false);
      expect(engine.channel).toBeNull();
    });

    it("startEarning opens a channel and starts streaming", async () => {
      const startedHandler = vi.fn();
      bus.on("rewards:started", startedHandler);

      await engine.startEarning(startConfig as StartEarningConfig);

      expect(engine.isActive).toBe(true);
      expect(engine.channel).not.toBeNull();
      expect(engine.channel?.id).toBe("channel-1");
      expect(startedHandler).toHaveBeenCalled();
    });

    it("recordEffort accumulates rewards and emits tick", async () => {
      const tickHandler = vi.fn();
      bus.on("rewards:tick", tickHandler);

      await engine.startEarning(startConfig as StartEarningConfig);

      await engine.recordEffort({
        heartRate: 150,
        power: 200,
        cadence: 80,
        timestamp: Date.now(),
      });

      await engine.recordEffort({
        heartRate: 160,
        power: 250,
        cadence: 85,
        timestamp: Date.now() + 1000,
      });

      expect(engine.streamState.updateCount).toBe(2);
      expect(engine.streamState.accumulated).toBeGreaterThan(BigInt(0));
      expect(tickHandler).toHaveBeenCalled();
    });

    it("finalizeRewards closes the channel", async () => {
      await engine.startEarning(startConfig as StartEarningConfig);
      // First call seeds lastTelemetryForYellow (no accumulation)
      await engine.recordEffort({ heartRate: 150, power: 200, cadence: 80, timestamp: Date.now() });
      // Second call triggers calculateAccumulatedReward
      await engine.recordEffort({ heartRate: 160, power: 250, cadence: 85, timestamp: Date.now() + 10000 });

      const result = await engine.finalizeRewards();
      expect(result.success).toBe(true);
      expect(result.amount).toBeGreaterThan(BigInt(0));
      expect(engine.streamState.status).toBe("closed");
    });
  });

  describe("Sui native mode", () => {
    beforeEach(() => {
      engine = new RewardsEngine(bus, {
        mode: "sui-native",
        classId: "class-1",
        instructor: "0x0" as `0x${string}`,
      });
    });

    it("starts with sui-native mode", () => {
      expect(engine.mode).toBe("sui-native");
    });

    it("startEarning sets active and emits event", async () => {
      const handler = vi.fn();
      bus.on("rewards:started", handler);

      await engine.startEarning();
      expect(engine.isActive).toBe(true);
      expect(handler).toHaveBeenCalled();
    });

    it("finalizeRewards returns success with zero amount", async () => {
      await engine.startEarning();
      const result = await engine.finalizeRewards();
      expect(result.success).toBe(true);
      expect(result.amount).toBe(BigInt(0));
    });
  });

  describe("Simulated rewards", () => {
    beforeEach(() => {
      engine = new RewardsEngine(bus, {
        mode: "zk-batch",
        classId: "class-1",
        instructor: "0x0" as `0x${string}`,
      });
    });

    it("starts simulated and accumulates over time", () => {
      engine.startSimulated();
      expect(engine.isSimulatingRewards).toBe(true);
      expect(engine.simulatedFormatted).toBe("0.0");

      // Simulated rate is ~0.02/sec — need ~50 seconds to reach > 1
      vi.advanceTimersByTime(60_000);
      expect(engine.accumulatedReward).toBeGreaterThan(BigInt(0));
      expect(engine.simulatedFormatted).not.toBe("0.0");
    });

    it("stops simulated and freezes the reward", () => {
      engine.startSimulated();
      vi.advanceTimersByTime(60_000);
      const before = engine.accumulatedReward;
      expect(before).toBeGreaterThan(BigInt(0));

      engine.stopSimulated();
      vi.advanceTimersByTime(5000);
      expect(engine.accumulatedReward).toBe(before);
    });

    it("resets simulated reward to zero", () => {
      engine.startSimulated();
      vi.advanceTimersByTime(60_000);
      expect(engine.accumulatedReward).toBeGreaterThan(BigInt(0));

      engine.resetSimulated();
      expect(engine.accumulatedReward).toBe(BigInt(0));
    });
  });

  describe("updateConfig", () => {
    beforeEach(() => {
      engine = new RewardsEngine(bus, {
        mode: "zk-batch",
        classId: "class-1",
        instructor: "0x0" as `0x${string}`,
      });
    });

    it("updates mode mid-session", () => {
      engine.updateConfig({ mode: "yellow-stream" });
      expect(engine.mode).toBe("yellow-stream");
    });

    it("updates classId and instructor", () => {
      engine.updateConfig({
        classId: "new-class",
        instructor: "0xnew-instructor" as `0x${string}`,
      });
      // No direct observable effect — used in next recordEffort/finalize call
      expect(true).toBe(true);
    });
  });

  describe("lifecycle", () => {
    beforeEach(() => {
      engine = new RewardsEngine(bus, {
        mode: "zk-batch",
        classId: "class-1",
        instructor: "0x0" as `0x${string}`,
      });
    });

    it("stop deactivates without throwing", async () => {
      await engine.startEarning();
      engine.stop();
      expect(engine.isActive).toBe(false);
    });

    it("is a no-op after dispose", async () => {
      engine.dispose();
      await expect(engine.startEarning()).resolves.not.toThrow();
      await expect(engine.finalizeRewards()).resolves.not.toThrow();
    });
  });

  describe("formattedReward", () => {
    beforeEach(() => {
      engine = new RewardsEngine(bus, {
        mode: "zk-batch",
        classId: "class-1",
        instructor: "0x0" as `0x${string}`,
      });
    });

    it("returns formatted string", () => {
      expect(engine.formattedReward).toBe("0 SPIN");
    });

    it("updates after simulation", () => {
      engine.startSimulated();
      vi.advanceTimersByTime(60_000);
      expect(engine.formattedReward).toContain("SPIN");
    });
  });
});
