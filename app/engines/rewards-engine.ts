/**
 * RewardsEngine — Manages reward accrual across three modes:
 *
 * - "yellow-stream" — Real-time micro-rewards via Yellow state channels
 * - "zk-batch" — Privacy-preserving batch rewards with ZK proofs
 * - "sui-native" — Native Sui SPIN token rewards (placeholder)
 *
 * Design rules:
 * - Plain TS class — no React imports.
 * - Wraps existing library functions from @/app/lib/rewards/ without
 *   duplicating them.
 * - Emits reward state (tick, finalized) via EventBus for the UI layer.
 * - Simulated rewards for training/guest mode are inlined here rather
 *   than in a separate hook.
 */

import { EventBus } from "./event-bus";
import type { RewardMode, RewardStreamState, SignedRewardUpdate, RewardChannel } from "@/app/lib/rewards";
import type { TelemetryPoint } from "@/app/lib/zk/oracle";
import {
  calculateAccumulatedReward,
  calculateEffortScore,
  formatReward,
} from "@/app/lib/rewards/calculator";
import {
  createBatchAccumulator,
  addToBatch,
  type BatchAccumulator,
} from "@/app/lib/rewards/zk";
import {
  openRewardChannel,
  closeRewardChannel,
  getActiveChannel,
  isChannelOpen,
  getNextSequence,
} from "@/app/lib/rewards/yellow/channel";
import { submitState, isClearNodeConnected } from "@/app/lib/rewards/yellow/clearnode";

export interface RewardsEngineConfig {
  mode: RewardMode;
  classId: string;
  instructor: `0x${string}`;
  depositAmount?: bigint;
  zkThreshold?: number;
}

export interface StartEarningConfig {
  rider: `0x${string}`;
  instructor: `0x${string}`;
  classId: `0x${string}`;
  depositAmount: bigint;
  signUpdate: (params: {
    channelId: `0x${string}`;
    classId: `0x${string}`;
    rider: `0x${string}`;
    instructor: `0x${string}`;
    timestamp: number;
    sequence: number;
    accumulatedReward: bigint;
    heartRate: number;
    power: number;
  }) => Promise<string>;
  extraParticipants?: `0x${string}`[];
}

export interface FinalizeResult {
  success: boolean;
  amount: bigint;
  hash?: string;
}

const SIMULATED_RATE_PER_SECOND = (10 + (500 * 90) / 1000) / (45 * 60);

export class RewardsEngine {
  private readonly bus: EventBus;
  private config: RewardsEngineConfig;
  private disposed = false;

  // ─── Mode-switchable state ────────────────────────────────────

  mode: RewardMode;
  isActive = false;
  isConnecting = false;
  error: Error | null = null;

  // Accumulated reward (bigint for production, number for simulated)
  accumulatedReward: bigint = BigInt(0);

  // ─── Yellow-specific state ────────────────────────────────────

  channel: RewardChannel | null = null;
  updates: SignedRewardUpdate[] = [];
  streamState: RewardStreamState = {
    accumulated: BigInt(0),
    lastUpdate: 0,
    updateCount: 0,
    status: "closed",
  };
  clearNodeConnected = false;
  lastTelemetryForYellow: TelemetryPoint | null = null;
  private yellowStreamTimerId: ReturnType<typeof setInterval> | null = null;

  // ─── ZK-specific state ────────────────────────────────────────

  batchAccumulator: BatchAccumulator | null = null;

  // ─── Simulated rewards state ──────────────────────────────────

  private isSimulating = false;
  private simulatedReward = 0;
  private simulatedTimerId: ReturnType<typeof setInterval> | null = null;

  constructor(
    bus: EventBus,
    config: RewardsEngineConfig,
  ) {
    this.bus = bus;
    this.config = config;
    this.mode = config.mode;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────

  async startEarning(startConfig?: StartEarningConfig): Promise<void> {
    if (this.disposed) return;

    switch (this.mode) {
      case "yellow-stream": {
        if (!startConfig) throw new Error("startConfig required for yellow-stream mode");
        await this.startYellowStreaming(startConfig);
        break;
      }
      case "zk-batch": {
        this.batchAccumulator = createBatchAccumulator();
        this.isActive = true;
        this.bus.emit("rewards:started", {});
        break;
      }
      case "sui-native": {
        // Placeholder — Sui mode handled by legacy hooks
        this.isActive = true;
        this.bus.emit("rewards:started", {});
        break;
      }
    }
  }

  async recordEffort(telemetry: TelemetryPoint): Promise<void> {
    if (this.disposed || !this.isActive) return;

    switch (this.mode) {
      case "yellow-stream": {
        await this.recordYellowEffort(telemetry);
        break;
      }
      case "zk-batch": {
        this.recordZkEffort(telemetry);
        break;
      }
      case "sui-native": {
        // Placeholder
        break;
      }
    }
  }

  async finalizeRewards(): Promise<FinalizeResult> {
    if (this.disposed) return { success: false, amount: BigInt(0) };

    switch (this.mode) {
      case "yellow-stream":
        return await this.finalizeYellow();
      case "zk-batch":
        return await this.finalizeZk();
      case "sui-native":
        this.isActive = false;
        this.bus.emit("rewards:finalized", {});
        return { success: true, amount: BigInt(0) };
    }
  }

  stop(): void {
    this.clearAllTimers();
    this.isActive = false;
    this.isSimulating = false;
  }

  dispose(): void {
    this.disposed = true;
    this.clearAllTimers();
    this.stopYellowChannel().catch(() => {});
    this.batchAccumulator = null;
    this.isActive = false;
    this.isSimulating = false;
  }

  // ─── Simulated Rewards ────────────────────────────────────────

  /** Start simulated reward ticker for training/guest mode */
  startSimulated(): void {
    if (this.disposed || this.isSimulating) return;
    this.isSimulating = true;
    this.simulatedReward = 0;

    this.simulatedTimerId = setInterval(() => {
      this.simulatedReward += SIMULATED_RATE_PER_SECOND;
      this.accumulatedReward = BigInt(Math.floor(this.simulatedReward));
      this.emitTick();
    }, 1000);
  }

  stopSimulated(): void {
    this.isSimulating = false;
    if (this.simulatedTimerId) {
      clearInterval(this.simulatedTimerId);
      this.simulatedTimerId = null;
    }
  }

  /** Reset simulated reward counter */
  resetSimulated(): void {
    this.simulatedReward = 0;
    this.accumulatedReward = BigInt(0);
  }

  get simulatedFormatted(): string {
    return this.simulatedReward.toFixed(1);
  }

  get isSimulatingRewards(): boolean {
    return this.isSimulating;
  }

  // ─── Config update ────────────────────────────────────────────

  updateConfig(partial: Partial<RewardsEngineConfig>): void {
    this.config = { ...this.config, ...partial };
    if (partial.mode) this.mode = partial.mode;
  }

  // ─── Yellow Streaming ─────────────────────────────────────────

  private async startYellowStreaming(
    startConfig: StartEarningConfig,
  ): Promise<void> {
    this.isConnecting = true;
    this.error = null;

    try {
      const ch = await openRewardChannel(
        startConfig.rider,
        startConfig.instructor,
        startConfig.classId,
        startConfig.depositAmount,
        {
          onOpen: () => {
            this.isActive = true;
            this.isConnecting = false;
            this.bus.emit("rewards:started", {});
          },
          onError: (err) => {
            this.error = err;
            this.isConnecting = false;
          },
        },
        startConfig.extraParticipants,
      );

      this.channel = ch;
      this.updates = [];
      this.isActive = true;
      this.isConnecting = false;
      this.bus.emit("rewards:started", {});
      this.streamState = {
        accumulated: BigInt(0),
        lastUpdate: Date.now(),
        updateCount: 0,
        status: "open",
      };

      // Start periodic update timer
      this.yellowStreamTimerId = setInterval(() => {
        if (this.lastTelemetryForYellow) {
          this.recordYellowEffort(this.lastTelemetryForYellow).catch(() => {});
        }
      }, 10_000);

      this.clearNodeConnected = isClearNodeConnected();
    } catch (err) {
      this.error = err instanceof Error ? err : new Error(String(err));
      this.isConnecting = false;
      throw this.error;
    }
  }

  private async recordYellowEffort(
    telemetry: TelemetryPoint,
  ): Promise<void> {
    if (!this.channel || !isChannelOpen()) return;

    const now = Date.now();
    const sequence = getNextSequence();
    const prevAccumulated = this.streamState.accumulated;

    let newAccumulated: bigint;
    if (this.lastTelemetryForYellow) {
      newAccumulated = calculateAccumulatedReward(
        { heartRate: telemetry.heartRate, power: telemetry.power },
        {
          heartRate: this.lastTelemetryForYellow.heartRate,
          power: this.lastTelemetryForYellow.power,
          timestamp: this.lastTelemetryForYellow.timestamp,
        },
        prevAccumulated,
      );
    } else {
      newAccumulated = prevAccumulated;
    }

    this.streamState = {
      accumulated: newAccumulated,
      lastUpdate: now,
      updateCount: this.streamState.updateCount + 1,
      status: "open",
    };
    this.accumulatedReward = newAccumulated;

    // Submit to ClearNode (best-effort)
    if (this.clearNodeConnected) {
      submitState(
        this.channel.id as `0x${string}`,
        this.channel.rider,
        newAccumulated,
        sequence,
        telemetry,
        [this.channel.rider, this.channel.instructor],
      ).catch(() => {}); // Best-effort
    }

    this.lastTelemetryForYellow = { ...telemetry, timestamp: now };
    this.emitTick();
  }

  private async stopYellowChannel(): Promise<void> {
    if (this.yellowStreamTimerId) {
      clearInterval(this.yellowStreamTimerId);
      this.yellowStreamTimerId = null;
    }
    if (this.channel) {
      try {
        await closeRewardChannel(this.streamState.accumulated);
      } catch {
        // Best-effort
      }
    }
    this.streamState = { ...this.streamState, status: "closed" };
  }

  private async finalizeYellow(): Promise<FinalizeResult> {
    await this.stopYellowChannel();
    this.isActive = false;
    this.bus.emit("rewards:finalized", {});
    return {
      success: true,
      amount: this.streamState.accumulated,
      hash: this.channel?.id,
    };
  }

  // ─── ZK Batch ─────────────────────────────────────────────────

  private recordZkEffort(telemetry: TelemetryPoint): void {
    if (!this.batchAccumulator) {
      this.batchAccumulator = createBatchAccumulator();
    }
    this.batchAccumulator = addToBatch(
      this.batchAccumulator,
      telemetry.heartRate,
      telemetry.power || 0,
    );
  }

  private async finalizeZk(): Promise<FinalizeResult> {
    if (!this.batchAccumulator) {
      this.isActive = false;
      return { success: false, amount: BigInt(0) };
    }

    const effortScore = calculateEffortScore({
      heartRate: this.batchAccumulator.maxHeartRate,
      power: this.batchAccumulator.avgPower,
      durationSeconds: this.batchAccumulator.totalDuration,
    });

    this.isActive = false;
    this.bus.emit("rewards:finalized", {});

    return {
      success: true,
      amount: BigInt(10 + Math.floor((effortScore * 90) / 1000)),
      hash: undefined,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private clearAllTimers(): void {
    if (this.yellowStreamTimerId) {
      clearInterval(this.yellowStreamTimerId);
      this.yellowStreamTimerId = null;
    }
    if (this.simulatedTimerId) {
      clearInterval(this.simulatedTimerId);
      this.simulatedTimerId = null;
    }
  }

  private emitTick(): void {
    this.bus.emit("rewards:tick", {
      accumulated: this.accumulatedReward,
    });
  }

  /** Get formatted reward string */
  get formattedReward(): string {
    return formatReward(this.accumulatedReward);
  }
}
