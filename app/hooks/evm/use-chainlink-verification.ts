"use client";

import { useState, useCallback } from "react";
import { useTransaction } from "./use-transaction";
import { CONTRACTS, CHAINLINK_CONFIG } from "@/app/config";
import type { TelemetryPoint } from "@/app/lib/zk/oracle";

interface ChainlinkVerificationParams {
  classId: `0x${string}`;
  threshold: number;
  duration: number;
}

export function useChainlinkVerification() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [requestId, setRequestId] = useState<`0x${string}` | null>(null);

  const requestTx = useTransaction({
    successMessage: "Verification requested",
    pendingMessage: "Requesting Chainlink verification...",
  });

  const claimTx = useTransaction({
    successMessage: "Rewards claimed via Chainlink proof!",
    pendingMessage: "Claiming rewards...",
  });

  /**
   * Request biometric verification via Chainlink Runtime Environment (CRE)
   * CRE now fetches telemetry directly via Confidential HTTP, so no encrypted data payload is needed.
   */
  const requestVerification = useCallback(
    async ({ classId, threshold, duration }: ChainlinkVerificationParams) => {
      setIsVerifying(true);

      try {
        // Request verification from Chainlink oracle
        // The CRE workflow will detect this event and fetch telemetry automatically
        await requestTx.write({
          address: CONTRACTS.avalanche.biometricOracle,
          abi: [
            {
              name: "requestVerification",
              type: "function",
              stateMutability: "nonpayable",
              inputs: [
                { name: "classId", type: "bytes32" },
                { name: "threshold", type: "uint16" },
                { name: "duration", type: "uint16" },
              ],
              outputs: [{ name: "requestId", type: "bytes32" }],
            },
          ],
          functionName: "requestVerification",
          args: [classId, threshold, duration],
        });

        // Store request ID for polling
        // In production, this would come from transaction logs
        setRequestId(classId); // Simplified

        setIsVerifying(false);
        return true;
      } catch (error) {
        setIsVerifying(false);
        throw error;
      }
    },
    [requestTx]
  );

  /**
   * Claim rewards after Chainlink verification completes
   */
  const claimRewards = useCallback(
    async (classId: `0x${string}`) => {
      await claimTx.write({
        address: CONTRACTS.avalanche.incentiveEngine,
        abi: [
          {
            name: "submitChainlinkProof",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [{ name: "classId", type: "bytes32" }],
            outputs: [],
          },
        ],
        functionName: "submitChainlinkProof",
        args: [classId],
      });
    },
    [claimTx]
  );

  /**
   * Check verification status
   */
  const checkVerificationStatus = useCallback(
    async (classId: `0x${string}`, rider: `0x${string}`): Promise<number> => {
      // This would use useReadContract in production
      // Returns effort score (0 if not verified)
      return 0; // Simplified
    },
    []
  );

  return {
    // Actions
    requestVerification,
    claimRewards,
    checkVerificationStatus,

    // State
    isVerifying,
    isClaiming: claimTx.isPending,
    requestId,
    isSuccess: claimTx.isSuccess,
    hash: claimTx.hash,
    error: requestTx.error || claimTx.error,

    // Config
    chainlinkConfig: CHAINLINK_CONFIG,
  };
}
