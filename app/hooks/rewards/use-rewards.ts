/**
 * Consolidated Rewards Hook
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Unifies Yellow, ZK, and Sui reward modes
 * - DRY: Single interface for all reward operations
 * - CLEAN: Clear mode switching with consistent API
 * - MODULAR: Each mode is swappable and independently testable
 * 
 * Replaces: useZKClaim, useSuiRewards (legacy hooks)
 */

"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { useYellowSettlement } from "@/app/hooks/evm/use-yellow-settlement";
import { useZKClaim as useOnchainZKClaim } from "@/app/hooks/evm/use-zk-claim";
import type { TelemetryPoint } from "@/app/lib/zk/oracle";
import {
  // Types
  type RewardMode,
  type RewardModeConfig,
  type RewardChannel,
  type RewardStreamState,
  type SignedRewardUpdate,
  REWARD_MODES,
  // Calculator
  formatReward,
  parseReward,
  calculateRewardFromScore,
  // Yellow
  useYellowStreaming,
  getStreamingStatus,
  calculateStreamingRate,
  isClearNodeConnected,
  // ZK
  createBatchAccumulator,
  addToBatch,
  type BatchAccumulator,
} from "@/app/lib/rewards";

// Re-export types for consumers
export type { RewardMode, RewardStreamState, SignedRewardUpdate };
export { REWARD_MODES, formatReward, parseReward };

// ============================================================================
// Configuration
// ============================================================================

export interface UseRewardsConfig {
  /** Reward mode - determines how rewards are calculated and distributed */
  mode: RewardMode;
  /** Class ID for this reward session */
  classId: string;
  /** Instructor address */
  instructor: `0x${string}`;
  /** Initial deposit amount (for Yellow mode) */
  depositAmount?: bigint;
  /** ZK threshold for effort proofs */
  zkThreshold?: number;
}

// ============================================================================
// Return Type
// ============================================================================

export type ChainAvailability = "connected" | "degraded" | "unavailable";

export interface ChainHealth {
  avalanche: ChainAvailability;
  yellow: ChainAvailability;
  sui: ChainAvailability;
}

export interface UseRewardsReturn {
  // Mode configuration
  mode: RewardMode;
  modeConfig: RewardModeConfig;
  
  // Actions
  startEarning: () => Promise<void>;
  recordEffort: (telemetry: TelemetryPoint) => Promise<void>;
  finalizeRewards: () => Promise<{ success: boolean; amount: bigint; hash?: string }>;
  
  // State
  accumulatedReward: bigint;
  formattedReward: string;
  isActive: boolean;
  isConnecting: boolean;
  isGeneratingProof: boolean;
  error: Error | null;
  
  // Streaming (Yellow mode only)
  streamState?: RewardStreamState;
  streamingStatus?: { label: string; color: string; icon: string };
  streamingRate?: bigint;
  
  // ZK (ZK mode only)
  privacyScore?: number;
  privacyLevel?: string;
  
  // Channel (Yellow mode only)
  channel?: RewardChannel | null;
  
  // Updates history (Yellow mode)
  updates?: SignedRewardUpdate[];

  // ClearNode WebSocket connection status (Yellow mode only)
  clearNodeConnected?: boolean;

  // Per-chain health for graceful degradation UI
  chainHealth: ChainHealth;
}

// ============================================================================
// Hook
// ============================================================================

export function useRewards(config: UseRewardsConfig): UseRewardsReturn {
  const { address: rider } = useAccount();
  const { mode, classId, instructor, depositAmount = BigInt(0), zkThreshold = 150 } = config;
  
  // Get mode configuration
  const modeConfig = REWARD_MODES[mode];
  
  // Mode-specific hooks
  const yellow = useYellowStreaming();
  const zkClaim = useOnchainZKClaim();
  const yellowSettlement = useYellowSettlement();
  
  // Local state for batch accumulation (ZK mode)
  const [batchAccumulator, setBatchAccumulator] = useState<BatchAccumulator | null>(null);
  
  // Updates history (Yellow mode)
  const [updates, setUpdates] = useState<SignedRewardUpdate[]>([]);

  // ============================================================================
  // Start Earning
  // ============================================================================
  
  const startEarning = useCallback(async (): Promise<void> => {
    switch (mode) {
      case "yellow-stream": {
        if (!rider) throw new Error("Wallet required for Yellow streaming");

        await yellow.startStreaming(
          rider,
          instructor,
          classId as `0x${string}`,
          depositAmount,
          yellowSettlement.signUpdate
        );
        break;
      }
      
      case "zk-batch": {
        // Initialize batch accumulator
        setBatchAccumulator(createBatchAccumulator());
        break;
      }
      
      case "sui-native": {
        // Sui mode - handled by useSuiRewards (legacy)
        // For now, just initialize
        console.log("[Rewards] Sui mode initialized");
        break;
      }
    }
  }, [mode, rider, instructor, classId, depositAmount, yellow, yellowSettlement]);

  // ============================================================================
  // Record Effort
  // ============================================================================
  
  const recordEffort = useCallback(async (telemetry: TelemetryPoint): Promise<void> => {
    switch (mode) {
      case "yellow-stream": {
        const signed = await yellow.sendUpdate(telemetry);
        if (signed) {
          setUpdates((prev) => [...prev, signed]);
        }
        break;
      }
      
      case "zk-batch": {
        if (!batchAccumulator) return;
        
        const newBatch = addToBatch(
          batchAccumulator,
          telemetry.heartRate,
          telemetry.power || 0
        );
        setBatchAccumulator(newBatch);
        break;
      }
      
      case "sui-native": {
        // Sui mode - accumulate for later minting
        console.log("[Rewards] Sui effort recorded:", telemetry);
        break;
      }
    }
  }, [mode, yellow, batchAccumulator]);

  // ============================================================================
  // Finalize Rewards
  // ============================================================================
  
  const finalizeRewards = useCallback(async (): Promise<{ 
    success: boolean; 
    amount: bigint; 
    hash?: string 
  }> => {
    switch (mode) {
      case "yellow-stream": {
        const closedChannel = await yellow.stopStreaming();
        if (!closedChannel) {
          return { success: false, amount: BigInt(0) };
        }

        // Rider signs the final state (EIP-712). Instructor will co-sign later in /instructor/yellow.
        const avgHeartRate = updates.length > 0 
          ? updates.reduce((sum, u) => sum + u.heartRate, 0) / updates.length 
          : 0;
        const avgPower = updates.length > 0 
          ? updates.reduce((sum, u) => sum + u.power, 0) / updates.length 
          : 0;
        
        const { calculateEffortScore } = await import("@/app/lib/rewards/calculator");
        const effortScore = Math.floor(calculateEffortScore({
          heartRate: avgHeartRate,
          power: avgPower,
          durationSeconds: updates.length * 10, // 10s intervals
        }));

        const riderSig = await yellowSettlement.signFinalState({
          channelId: closedChannel.id as `0x${string}`,
          classId: closedChannel.classId,
          rider: closedChannel.rider,
          instructor: closedChannel.instructor,
          finalReward: yellow.streamState.accumulated,
          effortScore,
        });

        const { upsertPendingSettlement, toStoredUpdates } = await import("@/app/lib/rewards");

        upsertPendingSettlement({
          id: closedChannel.id,
          channelId: closedChannel.id as `0x${string}`,
          classId: closedChannel.classId,
          rider: closedChannel.rider,
          instructor: closedChannel.instructor,
          finalReward: yellow.streamState.accumulated,
          effortScore,
          riderSignature: riderSig,
          instructorSignature: undefined,
          updates: toStoredUpdates(updates),
          status: "rider_signed",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        return {
          success: true,
          amount: yellow.streamState.accumulated,
          hash: closedChannel.id,
        };
      }
      
      case "zk-batch": {
        if (!batchAccumulator || !rider) {
          return { success: false, amount: BigInt(0) };
        }

        if (!isAddress(classId)) {
          console.warn("[Rewards] Skipping ZK claim for non-contract class:", classId);
          return { success: false, amount: BigInt(0) };
        }

        const heartRateSamples = batchAccumulator.telemetryPoints.map(
          (point) => point.heartRate,
        );
        const durationSeconds = Math.max(
          1,
          Math.floor(batchAccumulator.totalDuration || heartRateSamples.length),
        );
        const averageHeartRate =
          heartRateSamples.length > 0
            ? Math.round(
                heartRateSamples.reduce((sum, value) => sum + value, 0) /
                  heartRateSamples.length,
              )
            : batchAccumulator.maxHeartRate;

        const proofResult = await zkClaim.generateProof({
          heartRate: averageHeartRate,
          threshold: zkThreshold,
          durationSeconds,
          classId,
          riderId: rider,
          heartRateSamples,
          avgPower: batchAccumulator.avgPower,
        });

        if (!proofResult.success || !proofResult.proof) {
          return { success: false, amount: BigInt(0) };
        }

        await zkClaim.submitProof(
          {
            spinClass: classId,
            rider,
            rewardAmount: "0",
            classId,
          },
          proofResult.proof,
          proofResult.proofs,
          durationSeconds,
        );

        const reward = calculateRewardFromScore(
          proofResult.metadata?.aggregateEffortScore ??
            proofResult.disclosure?.revealed.effortScore ??
            0,
        );

        return {
          success: true,
          amount: reward.totalAmount,
          hash: zkClaim.hash,
        };
      }
      
      case "sui-native": {
        // Sui mode - would call useSuiRewards.mintReward
        console.log("[Rewards] Sui rewards finalized");
        return { success: true, amount: BigInt(0) };
      }
    }
  }, [
    mode,
    yellow,
    yellowSettlement,
    updates,
    batchAccumulator,
    classId,
    rider,
    zkClaim,
    zkThreshold,
  ]);

  // ============================================================================
  // Derived State
  // ============================================================================
  
  const accumulatedReward = useMemo(() => {
    switch (mode) {
      case "yellow-stream":
        return yellow.streamState.accumulated;
      case "zk-batch":
        // ZK rewards are calculated at finalize time
        return BigInt(0);
      case "sui-native":
        return BigInt(0);
    }
  }, [mode, yellow.streamState.accumulated]);

  const formattedReward = useMemo(() => {
    return formatReward(accumulatedReward);
  }, [accumulatedReward]);

  const isActive = useMemo(() => {
    switch (mode) {
      case "yellow-stream":
        return yellow.isActive;
      case "zk-batch":
        return !!batchAccumulator;
      case "sui-native":
        return false;
    }
  }, [mode, yellow.isActive, batchAccumulator]);

  const streamingStatus = useMemo(() => {
    if (mode !== "yellow-stream") return undefined;
    return getStreamingStatus(yellow.streamState);
  }, [mode, yellow.streamState]);

  const streamingRate = useMemo(() => {
    if (mode !== "yellow-stream") return undefined;
    return calculateStreamingRate(yellow.streamState);
  }, [mode, yellow.streamState]);

  // Poll ClearNode WebSocket status every 3s (Yellow mode only)
  const [clearNodeConnected, setClearNodeConnected] = useState<boolean | undefined>(
    mode === "yellow-stream" ? isClearNodeConnected() : undefined
  );
  useEffect(() => {
    if (mode !== "yellow-stream") return;
    setClearNodeConnected(isClearNodeConnected());
    const id = setInterval(() => setClearNodeConnected(isClearNodeConnected()), 3000);
    return () => clearInterval(id);
  }, [mode]);

  // ============================================================================
  // Return
  // ============================================================================
  
  return {
    // Mode
    mode,
    modeConfig,
    
    // Actions
    startEarning,
    recordEffort,
    finalizeRewards,
    
    // State
    accumulatedReward,
    formattedReward,
    isActive,
    isConnecting: mode === "yellow-stream" ? yellow.isConnecting : false,
    isGeneratingProof:
      mode === "zk-batch" ? zkClaim.isGeneratingProof : false,
    error: mode === "zk-batch" ? zkClaim.error : yellow.error,
    
    // Yellow-specific
    streamState: mode === "yellow-stream" ? yellow.streamState : undefined,
    streamingStatus,
    streamingRate,
    channel: yellow.channel,
    updates,
    
    // ZK-specific
    privacyScore: mode === "zk-batch" ? zkClaim.privacyScore : undefined,
    privacyLevel: mode === "zk-batch" ? zkClaim.privacyLevel : undefined,

    // ClearNode status
    clearNodeConnected: mode === "yellow-stream" ? clearNodeConnected : undefined,

    // Per-chain availability for UI degradation indicators
    chainHealth: {
      avalanche: (mode === "zk-batch" && zkClaim.error) ? "degraded" as const : "connected" as const,
      yellow: mode === "yellow-stream"
        ? (clearNodeConnected ? "connected" as const : yellow.error ? "unavailable" as const : "degraded" as const)
        : "unavailable" as const,
      sui: mode === "sui-native" ? "degraded" as const : "unavailable" as const,
    } satisfies ChainHealth,
  };
}

// ============================================================================
// Legacy Compatibility
// ============================================================================

/**
 * Legacy hook for backward compatibility
 * Uses ZK batch mode by default
 */
export function useZKClaim() {
  const rewards = useRewards({
    mode: "zk-batch",
    classId: "legacy",
    instructor: "0x0" as `0x${string}`,
  });

  return {
    generateProof: rewards.recordEffort,
    claimWithZK: rewards.finalizeRewards,
    isGeneratingProof: rewards.isGeneratingProof,
    privacyScore: rewards.privacyScore,
    privacyLevel: rewards.privacyLevel,
    isPending: false,
    isSuccess: false,
    error: rewards.error,
  };
}
