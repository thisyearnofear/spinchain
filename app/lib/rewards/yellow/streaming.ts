/**
 * Yellow Streaming Rewards
 *
 * Handles real-time reward accumulation and signed updates.
 * Submits state updates to ClearNode via SDK when connected,
 * with local state tracking as the primary source of truth.
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { TelemetryPoint } from "../../zk/oracle";
import type {
  RewardChannel,
  SignedRewardUpdate,
  RewardStreamState,
} from "../types";
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
import { submitState, isClearNodeConnected } from "./clearnode";
import { STREAMING_INTERVAL } from "./index";

// ============================================================================
// Types
// ============================================================================

export interface UseYellowStreamingReturn {
  // State
  channel: RewardChannel | null;
  streamState: RewardStreamState;
  updates: SignedRewardUpdate[];

  // Actions
  startStreaming: (
    rider: `0x${string}`,
    instructor: `0x${string}`,
    classId: `0x${string}`,
    depositAmount: bigint,
    messageSigner: MessageSigner,
  ) => Promise<void>;

  sendUpdate: (
    telemetry: TelemetryPoint,
  ) => Promise<SignedRewardUpdate | null>;

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

  // Signed updates for later settlement
  const [updates, setUpdates] = useState<SignedRewardUpdate[]>([]);

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
  const startStreaming = useCallback(
    async (
      rider: `0x${string}`,
      instructor: `0x${string}`,
      classId: `0x${string}`,
      depositAmount: bigint,
      messageSigner: MessageSigner,
    ): Promise<void> => {
      setIsConnecting(true);
      setError(null);

      try {
        messageSignerRef.current = messageSigner;

        const callbacks: ChannelCallbacks = {
          onOpen: (ch) => {
            setChannel(ch);
            setUpdates([]);
            setStreamState((prev) => ({
              ...prev,
              status: "open",
              lastUpdate: Date.now(),
            }));
          },
          onError: (err) => {
            setError(err);
            setStreamState((prev) => ({
              ...prev,
              status: "error",
              error: err.message,
            }));
          },
        };

        const ch = await openRewardChannel(
          rider,
          instructor,
          classId,
          depositAmount,
          callbacks,
        );

        setChannel(ch);
        setIsConnecting(false);

        // Start periodic updates
        intervalRef.current = setInterval(() => {
          if (lastTelemetryRef.current) {
            void sendUpdateInternal(lastTelemetryRef.current);
          }
        }, STREAMING_INTERVAL);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setIsConnecting(false);
        throw error;
      }
    },
    [],
  );

  /**
   * Send a telemetry update (internal)
   */
  const sendUpdateInternal = useCallback(
    async (
      telemetry: TelemetryPoint,
    ): Promise<SignedRewardUpdate | null> => {
      if (!isChannelOpen()) {
        console.warn("[YellowStreaming] Cannot send update: channel not open");
        return null;
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
            timestamp: lastTelemetryRef.current.timestamp,
          },
          streamState.accumulated,
        );
      } else {
        newAccumulated = streamState.accumulated;
      }

      if (!channel) {
        console.warn(
          "[YellowStreaming] Cannot send update: no channel in state",
        );
        return null;
      }

      // Create signed update payload (for on-chain settlement)
      const update: Omit<SignedRewardUpdate, "riderSignature"> = {
        channelId: channel.id as unknown as `0x${string}`,
        classId: channel.classId,
        rider: channel.rider,
        instructor: channel.instructor,
        timestamp: now,
        sequence,
        accumulatedReward: newAccumulated,
        heartRate: telemetry.heartRate,
        power: telemetry.power,
        instructorSignature: undefined,
      };

      // Sign the update with wallet (for on-chain settlement proof)
      let signature: string;
      try {
        signature = await messageSignerRef.current!(JSON.stringify(update));
      } catch (err) {
        console.error("[YellowStreaming] Failed to sign update:", err);
        return null;
      }

      const signedUpdate: SignedRewardUpdate = {
        ...update,
        riderSignature: signature,
      };

      // Submit to ClearNode via SDK (best-effort, non-blocking)
      if (isClearNodeConnected()) {
        submitState(
          channel.id as `0x${string}`,
          channel.rider,
          channel.instructor,
          newAccumulated,
          sequence,
          {
            heartRate: telemetry.heartRate,
            power: telemetry.power,
            timestamp: now,
          },
        ).catch((err) => {
          console.warn("[YellowStreaming] ClearNode update failed:", err);
        });
      }

      // Update refs and state
      lastTelemetryRef.current = { ...telemetry, timestamp: now };
      setUpdates((prev) => [...prev, signedUpdate]);
      setStreamState((prev) => ({
        accumulated: newAccumulated,
        lastUpdate: now,
        updateCount: prev.updateCount + 1,
        status: "open",
      }));

      return signedUpdate;
    },
    [streamState.accumulated, channel],
  );

  /**
   * Send a telemetry update (public API)
   */
  const sendUpdate = useCallback(
    async (
      telemetry: TelemetryPoint,
    ): Promise<SignedRewardUpdate | null> => {
      lastTelemetryRef.current = telemetry;

      if (isChannelOpen()) {
        return await sendUpdateInternal(telemetry);
      }

      return null;
    },
    [sendUpdateInternal],
  );

  /**
   * Stop streaming and close channel
   */
  const stopStreaming = useCallback(
    async (finalReward?: bigint): Promise<RewardChannel | null> => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      const reward = finalReward ?? streamState.accumulated;

      try {
        const closedChannel = await closeRewardChannel(reward);

        setStreamState((prev) => ({
          ...prev,
          status: "closed",
        }));

        return closedChannel;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setStreamState((prev) => ({
          ...prev,
          status: "error",
          error: error.message,
        }));
        return null;
      }
    },
    [streamState.accumulated],
  );

  return {
    channel,
    streamState,
    updates,
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
  streamState: RewardStreamState,
): bigint {
  if (streamState.updateCount === 0) return BigInt(0);

  const elapsedMinutes = (Date.now() - streamState.lastUpdate) / 60000;
  if (elapsedMinutes === 0) return BigInt(0);

  return streamState.accumulated / BigInt(Math.floor(elapsedMinutes));
}
