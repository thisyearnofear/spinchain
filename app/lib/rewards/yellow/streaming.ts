/**
 * Yellow Streaming Rewards
 * 
 * Handles real-time reward accumulation and signed updates
 * Integrates with the reward calculator for consistent calculations
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { TelemetryPoint } from "../../zk/oracle";
import type { RewardChannel, SignedRewardUpdate, RewardStreamState } from "../types";
import { calculateAccumulatedReward } from "../calculator";
import {
  openRewardChannel,
  closeRewardChannel,
  getActiveChannel,
  isChannelOpen,
  getNextSequence,
  type ChannelCallbacks,
  type MessageSigner,
} from "./channel";
import { STREAMING_INTERVAL } from "./index";

// ============================================================================
// Types
// ============================================================================

export interface UseYellowStreamingReturn {
  // State
  channel: RewardChannel | null;
  streamState: RewardStreamState;
  
  // Actions
  startStreaming: (
    rider: `0x${string}`,
    instructor: `0x${string}`,
    classId: `0x${string}`,
    depositAmount: bigint,
    messageSigner: MessageSigner
  ) => Promise<void>;
  
  sendUpdate: (telemetry: TelemetryPoint) => Promise<void>;
  
  stopStreaming: (finalReward?: bigint) => Promise<RewardChannel | null>;
  
  // Status
  isActive: boolean;
  isConnecting: boolean;
  error: Error | null;
}

// ============================================================================
// Hook
// ============================================================================

export function useYellowStreaming(): UseYellowStreamingReturn {
  // Channel state
  const [channel, setChannel] = useState<RewardChannel | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Streaming state
  const [streamState, setStreamState] = useState<RewardStreamState>({
    accumulated: BigInt(0),
    lastUpdate: 0,
    updateCount: 0,
    status: "closed",
  });

  // Refs for interval management
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTelemetryRef = useRef<TelemetryPoint | null>(null);
  const messageSignerRef = useRef<MessageSigner | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // Attempt graceful close if channel is open
      const activeChannel = getActiveChannel();
      if (activeChannel?.status === "open") {
        closeRewardChannel(streamState.accumulated).catch(console.error);
      }
    };
  }, [streamState.accumulated]);

  /**
   * Start streaming rewards via Yellow state channel
   */
  const startStreaming = useCallback(async (
    rider: `0x${string}`,
    instructor: `0x${string}`,
    classId: `0x${string}`,
    depositAmount: bigint,
    messageSigner: MessageSigner
  ): Promise<void> => {
    setIsConnecting(true);
    setError(null);

    try {
      messageSignerRef.current = messageSigner;

      const callbacks: ChannelCallbacks = {
        onOpen: (ch) => {
          setChannel(ch);
          setStreamState(prev => ({
            ...prev,
            status: "open",
            lastUpdate: Date.now(),
          }));
        },
        onError: (err) => {
          setError(err);
          setStreamState(prev => ({ ...prev, status: "error", error: err.message }));
        },
      };

      const ch = await openRewardChannel(
        rider,
        instructor,
        classId,
        depositAmount,
        callbacks
      );

      setChannel(ch);
      setIsConnecting(false);

      // Start periodic updates
      intervalRef.current = setInterval(() => {
        // Trigger update with last known telemetry
        if (lastTelemetryRef.current) {
          sendUpdateInternal(lastTelemetryRef.current);
        }
      }, STREAMING_INTERVAL);

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsConnecting(false);
      throw error;
    }
  }, []);

  /**
   * Send a telemetry update (internal)
   */
  const sendUpdateInternal = useCallback(async (telemetry: TelemetryPoint): Promise<void> => {
    if (!isChannelOpen()) {
      console.warn("[YellowStreaming] Cannot send update: channel not open");
      return;
    }

    const now = Date.now();
    const sequence = getNextSequence();

    // Calculate accumulated reward
    let newAccumulated: bigint;
    
    if (lastTelemetryRef.current) {
      newAccumulated = calculateAccumulatedReward(
        { heartRate: telemetry.heartRate, power: telemetry.power },
        { 
          heartRate: lastTelemetryRef.current.heartRate, 
          power: lastTelemetryRef.current.power,
          timestamp: lastTelemetryRef.current.timestamp 
        },
        streamState.accumulated
      );
    } else {
      // First update
      newAccumulated = streamState.accumulated;
    }

    // Create signed update
    const update: Omit<SignedRewardUpdate, "riderSignature"> = {
      timestamp: now,
      telemetry,
      accumulatedReward: newAccumulated,
      sequence,
    };

    // Sign the update
    let signature: string;
    try {
      signature = await messageSignerRef.current!(
        JSON.stringify(update)
      );
    } catch (err) {
      console.error("[YellowStreaming] Failed to sign update:", err);
      return;
    }

    const signedUpdate: SignedRewardUpdate = {
      ...update,
      riderSignature: signature,
    };

    // Send to Yellow (in production, this would go through the WebSocket)
    // For demo, we just update local state
    console.log("[YellowStreaming] Update sent:", {
      sequence,
      accumulated: newAccumulated.toString(),
    });

    // Update refs and state
    lastTelemetryRef.current = { ...telemetry, timestamp: now };
    setStreamState(prev => ({
      accumulated: newAccumulated,
      lastUpdate: now,
      updateCount: prev.updateCount + 1,
      status: "open",
    }));

    // In production, send to Yellow ClearNode:
    // ws.send(JSON.stringify({ type: 'reward_update', update: signedUpdate }));
  }, [streamState.accumulated]);

  /**
   * Send a telemetry update (public API)
   */
  const sendUpdate = useCallback(async (telemetry: TelemetryPoint): Promise<void> => {
    // Store for interval-based sending
    lastTelemetryRef.current = telemetry;
    
    // Send immediately if channel is open
    if (isChannelOpen()) {
      await sendUpdateInternal(telemetry);
    }
  }, [sendUpdateInternal]);

  /**
   * Stop streaming and close channel
   */
  const stopStreaming = useCallback(async (
    finalReward?: bigint
  ): Promise<RewardChannel | null> => {
    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const reward = finalReward ?? streamState.accumulated;

    try {
      const closedChannel = await closeRewardChannel(reward);
      
      setStreamState(prev => ({
        ...prev,
        status: "closed",
      }));

      return closedChannel;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setStreamState(prev => ({ ...prev, status: "error", error: error.message }));
      return null;
    }
  }, [streamState.accumulated]);

  return {
    channel,
    streamState,
    startStreaming,
    sendUpdate,
    stopStreaming,
    isActive: isChannelOpen(),
    isConnecting,
    error,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format streaming status for display
 */
export function getStreamingStatus(state: RewardStreamState): {
  label: string;
  color: string;
  icon: string;
} {
  switch (state.status) {
    case "open":
      return { label: "Streaming", color: "text-green-400", icon: "●" };
    case "opening":
      return { label: "Connecting", color: "text-yellow-400", icon: "◐" };
    case "closing":
      return { label: "Closing", color: "text-yellow-400", icon: "◑" };
    case "closed":
      return { label: "Settled", color: "text-gray-400", icon: "○" };
    case "error":
      return { label: "Error", color: "text-red-400", icon: "✕" };
    default:
      return { label: "Inactive", color: "text-gray-400", icon: "○" };
  }
}

/**
 * Calculate streaming rate (rewards per minute)
 */
export function calculateStreamingRate(
  streamState: RewardStreamState
): bigint {
  if (streamState.updateCount === 0) return BigInt(0);
  
  const elapsedMinutes = (Date.now() - streamState.lastUpdate) / 60000;
  if (elapsedMinutes === 0) return BigInt(0);
  
  return streamState.accumulated / BigInt(Math.floor(elapsedMinutes));
}
