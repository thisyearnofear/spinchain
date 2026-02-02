"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";

/**
 * Mock hook for Rider Session management until contracts are deployed.
 * Simulates purchasing a ticket and tracking attendance state.
 */
export function useRiderSession(classAddress: `0x${string}`) {
  const { isConnected } = useAccount();

  // Mock state: persisted only in memory for the demo
  const [attended, setAttended] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [hash, setHash] = useState<string | undefined>(undefined);

  const purchaseTicket = useCallback(async (price: string) => {
    if (!isConnected) {
        alert("Please connect your wallet first");
        return;
    }

    setIsPending(true);
    setHash(undefined);

    console.log(`Simulating ticket purchase for class ${classAddress} at ${price} ETH...`);

    // Simulate blockchain transaction delay (2s)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setAttended(true);
    setIsPending(false);
    // Mock transaction hash
    setHash("0x7f9a3e2b1c4d5e6f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f");
  }, [isConnected, classAddress]);

  return {
    purchaseTicket,
    attended,
    isPending,
    hash,
  };
}

export type ClaimRewardArgs = {
  spinClass: `0x${string}`;
  rider: `0x${string}`;
  rewardAmount: string;
  classId: `0x${string}`;
  claimHash: `0x${string}`;
  timestamp: number;
  signature: `0x${string}`;
};

/**
 * Mock hook for Claiming Rewards.
 * Simulates the interaction with the IncentiveEngine contract.
 */
export function useClaimRewards() {
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const claimReward = useCallback(async (args: ClaimRewardArgs) => {
    setIsPending(true);
    setError(null);
    setIsSuccess(false);

    console.log("Submitting proof and claiming rewards...", args);

    // Simulate blockchain transaction delay (2.5s)
    await new Promise((resolve) => setTimeout(resolve, 2500));

    // Simulate random failure for demo purposes (very low chance)
    const success = Math.random() > 0.05;

    setIsPending(false);

    if (success) {
        setIsSuccess(true);
    } else {
        setError(new Error("Transaction reverted: Signature invalid or already claimed"));
    }
  }, []);

  return {
    claimReward,
    isPending,
    isSuccess,
    error,
  };
}
