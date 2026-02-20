/**
 * Yellow State Channel Management
 * 
 * Handles channel lifecycle: open, updates, close
 * Uses ERC-7824 Nitrolite protocol via Yellow SDK
 */

"use client";

import type {
  RewardChannel,
  ChannelAllocation,
  SignedRewardUpdate,
} from "../types";
import {
  YELLOW_CLEARNODE_URL,
  SPINCHAIN_PROTOCOL,
  DEFAULT_CHANNEL_PARAMS,
} from "./index";

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
  ws: WebSocket | null;
  messageSigner: MessageSigner | null;
  sequence: number;
  callbacks: ChannelCallbacks;
}

// ============================================================================
// WebSocket Connection
// ============================================================================

let globalState: ChannelState = {
  channel: null,
  ws: null,
  messageSigner: null,
  sequence: 0,
  callbacks: {},
};

/**
 * Connect to Yellow ClearNode
 */
export async function connectToClearNode(
  url: string = YELLOW_CLEARNODE_URL
): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log("[Yellow] Connected to ClearNode");
      resolve(ws);
    };

    ws.onerror = (error) => {
      console.error("[Yellow] WebSocket error:", error);
      reject(new Error("Failed to connect to Yellow ClearNode"));
    };

    ws.onclose = () => {
      console.log("[Yellow] Disconnected from ClearNode");
      globalState.channel = null;
    };
  });
}

// ============================================================================
// Channel Lifecycle
// ============================================================================

/**
 * Create a message signer from an Ethereum wallet
 */
export async function createMessageSigner(
  ethereum: typeof window.ethereum
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
 * @param rider - Rider Ethereum address
 * @param instructor - Instructor Ethereum address
 * @param classId - Class ID
 * @param depositAmount - Initial deposit amount (wei)
 * @param callbacks - Event callbacks
 * @returns Reward channel
 */
export async function openRewardChannel(
  rider: `0x${string}`,
  instructor: `0x${string}`,
  classId: `0x${string}`,
  depositAmount: bigint,
  callbacks: ChannelCallbacks = {}
): Promise<RewardChannel> {
  // Connect to ClearNode
  const ws = await connectToClearNode();
  globalState.ws = ws;
  globalState.callbacks = callbacks;

  // Create channel
  // IMPORTANT: channelId must match the on-chain YellowSettlement expectedChannelId:
  // keccak256(abi.encode(chainId, settlementContract, rider, instructor, classId))
  // We compute it client-side for maintainability and deterministic settlement.
  const chainIdHex = (await window.ethereum?.request({ method: "eth_chainId" })) as string;
  if (!chainIdHex) throw new Error("Ethereum provider not available");
  const chainId = Number.parseInt(chainIdHex, 16);
  const settlementContract = (process.env.NEXT_PUBLIC_YELLOW_SETTLEMENT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;

  // Lazy import to keep this module lightweight
  const { keccak256, encodeAbiParameters, parseAbiParameters } = await import("viem");
  const id = keccak256(
    encodeAbiParameters(
      parseAbiParameters("uint256 chainId, address settlement, address rider, address instructor, bytes32 classId"),
      [BigInt(chainId), settlementContract, rider, instructor, classId]
    )
  );

  const channel: RewardChannel = {
    id,
    rider,
    instructor,
    classId,
    openedAt: Date.now(),
    depositAmount,
    status: "opening",
  };

  globalState.channel = channel;

  // Setup message handler
  ws.onmessage = (event) => {
    handleMessage(event.data);
  };

  // Send channel open message (simplified for demo)
  // In production, this would use createAppSessionMessage from @erc7824/nitrolite
  const openMessage = {
    type: "channel_open",
    protocol: SPINCHAIN_PROTOCOL,
    channelId: channel.id,
    participants: [rider, instructor],
    allocations: [
      { participant: rider, asset: "spin", amount: depositAmount.toString() },
      { participant: instructor, asset: "spin", amount: "0" },
    ],
    ...DEFAULT_CHANNEL_PARAMS,
    nonce: Date.now(),
  };

  ws.send(JSON.stringify(openMessage));

  // Wait for confirmation
  await waitForChannelConfirmation(channel.id);

  channel.status = "open";
  callbacks.onOpen?.(channel);

  console.log("[Yellow] Channel opened:", channel.id);
  return channel;
}

/**
 * Close channel and request settlement
 */
export async function closeRewardChannel(
  finalReward: bigint
): Promise<RewardChannel | null> {
  const { channel, ws } = globalState;
  
  if (!channel || !ws) {
    throw new Error("No active channel");
  }

  channel.status = "closing";

  const closeMessage = {
    type: "channel_close",
    channelId: channel.id,
    finalReward: finalReward.toString(),
    timestamp: Date.now(),
  };

  ws.send(JSON.stringify(closeMessage));

  // Wait for settlement confirmation
  await waitForSettlementConfirmation(channel.id);

  channel.status = "closed";
  channel.closedAt = Date.now();
  channel.finalAmount = finalReward;

  globalState.callbacks.onClose?.(channel);
  
  // Close WebSocket
  ws.close();
  globalState.ws = null;

  console.log("[Yellow] Channel closed:", channel.id);
  return channel;
}

// ============================================================================
// Message Handling
// ============================================================================

function handleMessage(data: string) {
  try {
    const message = JSON.parse(data);

    switch (message.type) {
      case "channel_confirmed":
        console.log("[Yellow] Channel confirmed:", message.channelId);
        break;

      case "update_received":
        console.log("[Yellow] Update received:", message.sequence);
        break;

      case "settlement_confirmed":
        console.log("[Yellow] Settlement confirmed");
        break;

      case "error":
        console.error("[Yellow] Error:", message.error);
        globalState.callbacks.onError?.(new Error(message.error));
        break;

      default:
        console.log("[Yellow] Unknown message:", message.type);
    }
  } catch (error) {
    console.error("[Yellow] Failed to parse message:", error);
  }
}

// ============================================================================
// Helpers
// ============================================================================

function waitForChannelConfirmation(channelId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Channel open timeout"));
    }, 10000);

    const checkConfirmation = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (
          message.type === "channel_confirmed" &&
          message.channelId === channelId
        ) {
          clearTimeout(timeout);
          globalState.ws?.removeEventListener("message", checkConfirmation);
          resolve();
        }
      } catch {
        // Ignore parse errors
      }
    };

    globalState.ws?.addEventListener("message", checkConfirmation);
  });
}

function waitForSettlementConfirmation(channelId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Settlement timeout"));
    }, 30000);

    const checkConfirmation = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (
          message.type === "settlement_confirmed" &&
          message.channelId === channelId
        ) {
          clearTimeout(timeout);
          globalState.ws?.removeEventListener("message", checkConfirmation);
          resolve();
        }
      } catch {
        // Ignore parse errors
      }
    };

    globalState.ws?.addEventListener("message", checkConfirmation);
  });
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
