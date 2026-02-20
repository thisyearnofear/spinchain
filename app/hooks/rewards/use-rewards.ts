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

import { useState, useCallback, useMemo } from "react";
import { useAccount } from "wagmi";
import { useYellowSettlement } from "@/app/hooks/evm/use-yellow-settlement";
import type { TelemetryPoint } from "@/app/lib/zk/oracle";
import {
  // Types
  type RewardMode,
  type RewardModeConfig,
  type RewardChannel,
  type RewardStreamState,
  type SignedRewardUpdate,
  type ZKProofInput,
  REWARD_MODES,
  // Calculator
  formatReward,
  parseReward,
  // Yellow
  useYellowStreaming,
  getStreamingStatus,
  calculateStreamingRate,
  // ZK
  useZKRewards,
  createBatchAccumulator,
  addToBatch,
  prepareZKInputFromBatch,
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
  const zk = useZKRewards();
  const yellowSettlement = useYellowSettlement();
  
  // Local state for batch accumulation (ZK mode)
  const [batchAccumulator, setBatchAccumulator] = useState<BatchAccumulator | null>(null);
  
  // Updates history (Yellow mode)
  const [updates, setUpdates] = useState<SignedRewardUpdate[]>([]);

  // ============================================================================
  // Start Earning
  // ============================================================================
  
  const startEarning = useCallback(async (): Promise<void> => {
    if (!rider) {
      throw new Error("Wallet not connected");
    }

    switch (mode) {
      case "yellow-stream": {
        // Create message signer from wallet
        const signer = async (message: string): Promise<string> => {
          if (!window.ethereum) throw new Error("MetaMask not available");
          return (await window.ethereum.request({
            method: "personal_sign",
            params: [message, rider],
          })) as string;
        };

        await yellow.startStreaming(
          rider,
          instructor,
          classId as `0x${string}`,
          depositAmount,
          signer
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
  }, [mode, rider, instructor, classId, depositAmount, yellow]);

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
        const effortScore = 0; // MVP: you can compute this from updates later.
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
        
        const input = prepareZKInputFromBatch(
          batchAccumulator,
          classId,
          rider,
          zkThreshold
        );
        
        const result = await zk.generateProof(input);
        
        // In production, this would submit to IncentiveEngine
        console.log("[Rewards] ZK proof generated:", result);
        
        return {
          success: result.success,
          amount: result.success ? parseReward("10") : BigInt(0), // Base reward
        };
      }
      
      case "sui-native": {
        // Sui mode - would call useSuiRewards.mintReward
        console.log("[Rewards] Sui rewards finalized");
        return { success: true, amount: BigInt(0) };
      }
    }
  }, [mode, yellow, batchAccumulator, classId, rider, zk, zkThreshold]);

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
    isConnecting: yellow.isConnecting,
    isGeneratingProof: zk.isGenerating,
    error: yellow.error,
    
    // Yellow-specific
    streamState: mode === "yellow-stream" ? yellow.streamState : undefined,
    streamingStatus,
    streamingRate,
    channel: yellow.channel,
    updates,
    
    // ZK-specific
    privacyScore: zk.lastResult?.privacyScore,
    privacyLevel: zk.lastResult?.privacyLevel,
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
