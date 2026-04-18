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

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
  const yellow = useYellowStreaming(mode === "yellow-stream");
  const zkClaim = useOnchainZKClaim();
  const yellowSettlement = useYellowSettlement();
  
  // Local state for batch accumulation (ZK mode)
  const [batchAccumulator, setBatchAccumulator] = useState<BatchAccumulator | null>(null);
  
  // Updates history (Yellow mode)
  const [updates, setUpdates] = useState<SignedRewardUpdate[]>([]);

  // Stabilize rapidly-changing values via refs so that useCallbacks don't
  // need them as dependencies, preventing React #185 infinite re-render loops.
  const batchAccumulatorRef = useRef(batchAccumulator);
  batchAccumulatorRef.current = batchAccumulator;
  const yellowRef = useRef(yellow);
  yellowRef.current = yellow;
  const yellowSettlementRef = useRef(yellowSettlement);
  yellowSettlementRef.current = yellowSettlement;
  const updatesRef = useRef(updates);
  updatesRef.current = updates;
  const zkClaimRef = useRef(zkClaim);
  zkClaimRef.current = zkClaim;

  // ============================================================================
  // Start Earning
  // ============================================================================
  
  const startEarning = useCallback(async (): Promise<void> => {
    switch (mode) {
      case "yellow-stream": {
        if (!rider) throw new Error("Wallet required for Yellow streaming");

        await yellowRef.current.startStreaming(
          rider,
          instructor,
          classId as `0x${string}`,
          depositAmount,
          yellowSettlementRef.current.signUpdate
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
  }, [mode, rider, instructor, classId, depositAmount]);

  // ============================================================================
  // Record Effort
  // ============================================================================
  
  // Read batch accumulator from ref to prevent callback recreation on every
  // addToBatch call (which creates a new object and cascades into React #185).
  const recordEffort = useCallback(async (telemetry: TelemetryPoint): Promise<void> => {
    switch (mode) {
      case "yellow-stream": {
        const signed = await yellowRef.current.sendUpdate(telemetry);
        if (signed) {
          setUpdates((prev) => [...prev, signed]);
        }
        break;
      }
      
      case "zk-batch": {
        const currentBatch = batchAccumulatorRef.current;
        if (!currentBatch) return;
        
        const newBatch = addToBatch(
          currentBatch,
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
  }, [mode]);

  // ============================================================================
  // Finalize Rewards
  // ============================================================================
  
  // Use refs for all frequently-changing values to prevent callback recreation,
  // which would cascade through the useMemo return value into React #185.
  const finalizeRewards = useCallback(async (): Promise<{ 
    success: boolean; 
    amount: bigint; 
    hash?: string 
  }> => {
    const currentYellow = yellowRef.current;
    const currentSettlement = yellowSettlementRef.current;
    const currentUpdates = updatesRef.current;
    const currentBatch = batchAccumulatorRef.current;
    const currentZkClaim = zkClaimRef.current;

    switch (mode) {
      case "yellow-stream": {
        const closedChannel = await currentYellow.stopStreaming();
        if (!closedChannel) {
          return { success: false, amount: BigInt(0) };
        }

        // Rider signs the final state (EIP-712). Instructor will co-sign later in /instructor/yellow.
        const avgHeartRate = currentUpdates.length > 0 
          ? currentUpdates.reduce((sum, u) => sum + u.heartRate, 0) / currentUpdates.length 
          : 0;
        const avgPower = currentUpdates.length > 0 
          ? currentUpdates.reduce((sum, u) => sum + u.power, 0) / currentUpdates.length 
          : 0;
        
        const { calculateEffortScore } = await import("@/app/lib/rewards/calculator");
        const effortScore = Math.floor(calculateEffortScore({
          heartRate: avgHeartRate,
          power: avgPower,
          durationSeconds: currentUpdates.length * 10, // 10s intervals
        }));

        const riderSig = await currentSettlement.signFinalState({
          channelId: closedChannel.id as `0x${string}`,
          classId: closedChannel.classId,
          rider: closedChannel.rider,
          instructor: closedChannel.instructor,
          finalReward: currentYellow.streamState.accumulated,
          effortScore,
        });

        const { upsertPendingSettlement, toStoredUpdates } = await import("@/app/lib/rewards");

        upsertPendingSettlement({
          id: closedChannel.id,
          channelId: closedChannel.id as `0x${string}`,
          classId: closedChannel.classId,
          rider: closedChannel.rider,
          instructor: closedChannel.instructor,
          finalReward: currentYellow.streamState.accumulated,
          effortScore,
          riderSignature: riderSig,
          instructorSignature: undefined,
          updates: toStoredUpdates(currentUpdates),
          status: "rider_signed",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        return {
          success: true,
          amount: currentYellow.streamState.accumulated,
          hash: closedChannel.id,
        };
      }
      
      case "zk-batch": {
        if (!currentBatch || !rider) {
          return { success: false, amount: BigInt(0) };
        }

        if (!isAddress(classId)) {
          console.warn("[Rewards] Skipping ZK claim for non-contract class:", classId);
          return { success: false, amount: BigInt(0) };
        }

        const heartRateSamples = currentBatch.telemetryPoints.map(
          (point) => point.heartRate,
        );
        const durationSeconds = Math.max(
          1,
          Math.floor(currentBatch.totalDuration || heartRateSamples.length),
        );
        const averageHeartRate =
          heartRateSamples.length > 0
            ? Math.round(
                heartRateSamples.reduce((sum, value) => sum + value, 0) /
                  heartRateSamples.length,
              )
            : currentBatch.maxHeartRate;

        const proofResult = await currentZkClaim.generateProof({
          heartRate: averageHeartRate,
          threshold: zkThreshold,
          durationSeconds,
          classId,
          riderId: rider,
          heartRateSamples,
          avgPower: currentBatch.avgPower,
        });

        if (!proofResult.success || !proofResult.proof) {
          return { success: false, amount: BigInt(0) };
        }

        await currentZkClaim.submitProof(
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
          hash: currentZkClaim.hash,
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
    classId,
    rider,
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
  // Return Value (Memoized to prevent unnecessary re-renders in consumers)
  // ============================================================================
  
  return useMemo(() => ({
    mode,
    modeConfig,
    startEarning,
    recordEffort,
    finalizeRewards,
    accumulatedReward,
    formattedReward,
    isActive,
    isConnecting: mode === "yellow-stream" ? yellow.isConnecting : false,
    isGeneratingProof: mode === "zk-batch" ? zkClaim.isGeneratingProof : false,
    error: mode === "yellow-stream" ? (yellow.error || yellowSettlement.error) : (mode === "zk-batch" ? zkClaim.error : null),
    streamState: mode === "yellow-stream" ? yellow.streamState : undefined,
    streamingStatus,
    streamingRate,
    privacyScore: mode === "zk-batch" ? zkClaim.privacyScore : undefined,
    privacyLevel: mode === "zk-batch" ? zkClaim.privacyLevel : undefined,
    channel: mode === "yellow-stream" ? yellow.channel : null,
    updates: mode === "yellow-stream" ? updates : [],
    clearNodeConnected,
    chainHealth: {
      avalanche: "connected",
      yellow: clearNodeConnected ? "connected" : "degraded",
      sui: "connected"
    }
  }), [
    mode,
    modeConfig,
    startEarning,
    recordEffort,
    finalizeRewards,
    accumulatedReward,
    formattedReward,
    isActive,
    yellow.isConnecting,
    yellow.error,
    yellow.streamState,
    yellow.channel,
    zkClaim.isGeneratingProof,
    zkClaim.error,
    zkClaim.privacyScore,
    zkClaim.privacyLevel,
    yellowSettlement.error,
    streamingStatus,
    streamingRate,
    updates,
    clearNodeConnected
  ]);
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
