"use client";

import { useCallback } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { useTransaction } from "./use-transaction";
import {
  YELLOW_SETTLEMENT_ADDRESS,
  YELLOW_SETTLEMENT_ABI,
  ACTIVE_NETWORK,
} from "@/app/lib/contracts";
import type { PendingYellowSettlement } from "@/app/lib/rewards/yellow/pending-store";

// EIP-712 types must match YellowSettlement.sol
const DOMAIN = {
  name: "SpinChainYellowSettlement",
  version: "1",
} as const;

const CHANNEL_STATE_TYPES = {
  ChannelState: [
    { name: "channelId", type: "bytes32" },
    { name: "rider", type: "address" },
    { name: "instructor", type: "address" },
    { name: "classId", type: "bytes32" },
    { name: "finalReward", type: "uint256" },
    { name: "effortScore", type: "uint16" },
  ],
} as const;

export function useYellowSettlement() {
  const { address } = useAccount();

  const { signTypedDataAsync } = useSignTypedData();

  const tx = useTransaction({
    successMessage: "Yellow channel settled on Avalanche",
    pendingMessage: "Settling Yellow channel...",
  });

  const signFinalState = useCallback(
    async (params: {
      channelId: `0x${string}`;
      classId: `0x${string}`;
      rider: `0x${string}`;
      instructor: `0x${string}`;
      finalReward: bigint;
      effortScore: number;
    }) => {
      const signature = await signTypedDataAsync({
        domain: {
          ...DOMAIN,
          chainId: ACTIVE_NETWORK.id,
          verifyingContract: YELLOW_SETTLEMENT_ADDRESS,
        },
        types: CHANNEL_STATE_TYPES,
        primaryType: "ChannelState",
        message: {
          channelId: params.channelId,
          rider: params.rider,
          instructor: params.instructor,
          classId: params.classId,
          finalReward: params.finalReward,
          effortScore: params.effortScore,
        },
      });

      return signature;
    },
    [signTypedDataAsync]
  );

  const settleOnChain = useCallback(
    async (pending: PendingYellowSettlement) => {
      if (!pending.instructorSignature) {
        throw new Error("Missing instructor signature");
      }

      // Solidity expects uint256 timestamps; we store ms in app.
      // For MVP, convert ms -> seconds.
      const updates = pending.updates.map((u) => ({
        channelId: u.channelId,
        classId: u.classId,
        rider: u.rider,
        instructor: u.instructor,
        timestamp: BigInt(Math.floor(u.timestamp / 1000)),
        sequence: BigInt(u.sequence),
        accumulatedReward: BigInt(u.accumulatedReward),
        heartRate: u.heartRate,
        power: u.power,
        signature: u.signature,
      }));

      const state = {
        channelId: pending.channelId,
        rider: pending.rider,
        instructor: pending.instructor,
        classId: pending.classId,
        finalReward: pending.finalReward,
        effortScore: pending.effortScore,
        riderSignature: pending.riderSignature,
        instructorSignature: pending.instructorSignature,
        settled: false,
      };

      tx.write({
        address: YELLOW_SETTLEMENT_ADDRESS,
        abi: YELLOW_SETTLEMENT_ABI,
        functionName: "settleChannel",
        args: [state, updates],
      });
    },
    [tx]
  );

  const canInstructorSign = useCallback(
    (pending: PendingYellowSettlement) => {
      if (!address) return false;
      return address.toLowerCase() === pending.instructor.toLowerCase();
    },
    [address]
  );

  const canRiderSign = useCallback(
    (pending: PendingYellowSettlement) => {
      if (!address) return false;
      return address.toLowerCase() === pending.rider.toLowerCase();
    },
    [address]
  );

  return {
    signFinalState,
    settleOnChain,
    canInstructorSign,
    canRiderSign,

    // tx state
    ...tx,
  };
}
