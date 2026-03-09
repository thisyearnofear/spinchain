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

const SIGNED_UPDATE_TYPES = {
  SignedUpdate: [
    { name: "channelId", type: "bytes32" },
    { name: "classId", type: "bytes32" },
    { name: "rider", type: "address" },
    { name: "instructor", type: "address" },
    { name: "timestamp", type: "uint256" },
    { name: "sequence", type: "uint256" },
    { name: "accumulatedReward", type: "uint256" },
    { name: "heartRate", type: "uint16" },
    { name: "power", type: "uint16" },
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

  const signUpdate = useCallback(
    async (params: {
      channelId: `0x${string}`;
      classId: `0x${string}`;
      rider: `0x${string}`;
      instructor: `0x${string}`;
      timestamp: number;
      sequence: number;
      accumulatedReward: bigint;
      heartRate: number;
      power: number;
    }) => {
      const signature = await signTypedDataAsync({
        domain: {
          ...DOMAIN,
          chainId: ACTIVE_NETWORK.id,
          verifyingContract: YELLOW_SETTLEMENT_ADDRESS,
        },
        types: SIGNED_UPDATE_TYPES,
        primaryType: "SignedUpdate",
        message: {
          channelId: params.channelId,
          classId: params.classId,
          rider: params.rider,
          instructor: params.instructor,
          timestamp: BigInt(Math.floor(params.timestamp / 1000)),
          sequence: BigInt(params.sequence),
          accumulatedReward: params.accumulatedReward,
          heartRate: params.heartRate,
          power: params.power,
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

  const batchSettleOnChain = useCallback(
    async (pendings: PendingYellowSettlement[]) => {
      const states = [];
      const updatesArray = [];

      for (const p of pendings) {
        if (!p.instructorSignature) continue;

        const updates = p.updates.map((u) => ({
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
          channelId: p.channelId,
          rider: p.rider,
          instructor: p.instructor,
          classId: p.classId,
          finalReward: p.finalReward,
          effortScore: p.effortScore,
          riderSignature: p.riderSignature,
          instructorSignature: p.instructorSignature,
          settled: false,
        };

        states.push(state);
        updatesArray.push(updates);
      }

      if (states.length === 0) throw new Error("No co-signed settlements to batch");

      tx.write({
        address: YELLOW_SETTLEMENT_ADDRESS,
        abi: YELLOW_SETTLEMENT_ABI,
        functionName: "batchSettle",
        args: [states, updatesArray],
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
    signUpdate,
    settleOnChain,
    batchSettleOnChain,
    canInstructorSign,
    canRiderSign,

    // tx state
    ...tx,
  };
}
