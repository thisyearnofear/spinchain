"use client";

import { useState, useCallback } from "react";
import { useTransaction } from "./use-transaction";
import { CONTRACTS, CHAINLINK_CONFIG } from "@/app/config";
import type { TelemetryPoint } from "@/app/lib/zk/oracle";

interface ChainlinkVerificationParams {
  classId: `0x${string}`;
  telemetryData: TelemetryPoint[];
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
   * Encrypt telemetry data for Chainlink Functions
   */
  const encryptTelemetry = useCallback(
    async (data: TelemetryPoint[]): Promise<string> => {
      // In production, this would use Chainlink's encryption
      // For now, we'll use a simple JSON encoding
      const jsonData = JSON.stringify(
        data.map((point) => ({
          heartRate: point.heartRate,
          power: point.power,
          cadence: point.cadence,
          timestamp: point.timestamp,
        }))
      );

      // Base64 encode for transport
      return Buffer.from(jsonData).toString("base64");
    },
    []
  );

  /**
   * Request biometric verification via Chainlink oracle
   */
  const requestVerification = useCallback(
    async ({ classId, telemetryData, threshold, duration }: ChainlinkVerificationParams) => {
      setIsVerifying(true);

      try {
        // Encrypt telemetry data
        const encryptedData = await encryptTelemetry(telemetryData);

        // Convert to bytes
        const encryptedBytes = `0x${Buffer.from(encryptedData).toString("hex")}` as `0x${string}`;

        // Request verification from Chainlink oracle
        await requestTx.write({
          address: CONTRACTS.avalanche.biometricOracle,
          abi: [
            {
              name: "requestVerification",
              type: "function",
              stateMutability: "nonpayable",
              inputs: [
                { name: "classId", type: "bytes32" },
                { name: "encryptedData", type: "bytes" },
                { name: "threshold", type: "uint16" },
                { name: "duration", type: "uint16" },
              ],
              outputs: [{ name: "requestId", type: "bytes32" }],
            },
          ],
          functionName: "requestVerification",
          args: [classId, encryptedBytes, threshold, duration],
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
    [encryptTelemetry, requestTx]
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
