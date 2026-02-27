/**
 * Yellow State Channel Management
 *
 * Handles channel lifecycle: open, updates, close
 * Uses ERC-7824 Nitrolite protocol via Yellow SDK
 */

"use client";

import type { RewardChannel, SignedRewardUpdate } from "../types";
import {
  createSession,
  closeSession,
  isClearNodeConnected,
  disconnectClearNode,
} from "./clearnode";

// ============================================================================
// Types
// ============================================================================

export interface MessageSigner {
  (message: string): Promise<string>;
}

export interface ChannelCallbacks {
  onOpen?: (channel: RewardChannel) => void;
  onUpdate?: (update: SignedRewardUpdate) => void;
  onClose?: (channel: RewardChannel) => void;
  onError?: (error: Error) => void;
}

export interface ChannelState {
  channel: RewardChannel | null;
  sequence: number;
  callbacks: ChannelCallbacks;
}

// ============================================================================
// State
// ============================================================================

let globalState: ChannelState = {
  channel: null,
  sequence: 0,
  callbacks: {},
};

// ============================================================================
// Channel Lifecycle
// ============================================================================

/**
 * Create a message signer from an Ethereum wallet
 */
export async function createMessageSigner(
  ethereum: NonNullable<typeof window.ethereum>,
): Promise<{ signer: MessageSigner; address: `0x${string}` }> {
  const accounts = (await ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];

  const address = accounts[0] as `0x${string}`;

  const signer: MessageSigner = async (message: string) => {
    return (await ethereum.request({
      method: "personal_sign",
      params: [message, address],
    })) as string;
  };

  return { signer, address };
}

/**
 * Open a reward channel between rider and instructor
 *
 * Creates an App Session on Yellow ClearNode via the SDK.
 * Falls back to local-only mode if ClearNode is unreachable.
 */
export async function openRewardChannel(
  rider: `0x${string}`,
  instructor: `0x${string}`,
  classId: `0x${string}`,
  depositAmount: bigint,
  callbacks: ChannelCallbacks = {},
): Promise<RewardChannel> {
  globalState.callbacks = callbacks;
  globalState.sequence = 0;

  let channelId: string = classId;

  try {
    const session = await createSession(rider, instructor, classId);
    channelId = session.appSessionId;
    console.log("[Yellow] App Session created:", channelId);
  } catch (err) {
    console.warn("[Yellow] ClearNode unavailable, using local mode:", err);
    // Generate a deterministic local ID for offline/demo mode
    const { keccak256, encodeAbiParameters, parseAbiParameters } =
      await import("viem");
    const chainIdHex = (await window.ethereum?.request({
      method: "eth_chainId",
    })) as string | undefined;
    const chainId = chainIdHex ? Number.parseInt(chainIdHex, 16) : 43113;
    const settlementContract = (process.env
      .NEXT_PUBLIC_YELLOW_SETTLEMENT_ADDRESS ||
      "0x0000000000000000000000000000000000000000") as `0x${string}`;

    channelId = keccak256(
      encodeAbiParameters(
        parseAbiParameters(
          "uint256 chainId, address settlement, address rider, address instructor, bytes32 classId",
        ),
        [
          BigInt(chainId),
          settlementContract,
          rider,
          instructor,
          classId,
        ],
      ),
    );
  }

  const channel: RewardChannel = {
    id: channelId,
    rider,
    instructor,
    classId,
    openedAt: Date.now(),
    depositAmount,
    status: "open",
  };

  globalState.channel = channel;
  callbacks.onOpen?.(channel);

  return channel;
}

/**
 * Close channel and request settlement
 */
export async function closeRewardChannel(
  finalReward: bigint,
): Promise<RewardChannel | null> {
  const { channel } = globalState;

  if (!channel) {
    throw new Error("No active channel");
  }

  channel.status = "closing";

  try {
    await closeSession(
      channel.id as `0x${string}`,
      channel.rider,
      channel.instructor,
      finalReward,
    );
    console.log("[Yellow] App Session closed:", channel.id);
  } catch (err) {
    console.warn("[Yellow] ClearNode close failed, settling locally:", err);
  }

  channel.status = "closed";
  channel.closedAt = Date.now();
  channel.finalAmount = finalReward;

  globalState.callbacks.onClose?.(channel);

  return channel;
}

// ============================================================================
// State Access
// ============================================================================

export function getActiveChannel(): RewardChannel | null {
  return globalState.channel;
}

export function isChannelOpen(): boolean {
  return globalState.channel?.status === "open";
}

export function getNextSequence(): number {
  return ++globalState.sequence;
}
