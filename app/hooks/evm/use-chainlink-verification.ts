"use client";

import { useState, useCallback } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useTransaction } from "./use-transaction";
import { CONTRACTS, CHAINLINK_CONFIG } from "@/app/config";
import { BIOMETRIC_ORACLE_ABI, INCENTIVE_ENGINE_ABI } from "@/app/lib/contracts";

interface ChainlinkVerificationParams {
  classId: `0x${string}`;
  threshold: number;
  duration: number;
}

export function useChainlinkVerification() {
  const { address } = useAccount();
  const [isVerifying, setIsVerifying] = useState(false);
  const [requestId, setRequestId] = useState<`0x${string}` | null>(null);

  const requestTx = useTransaction({
    successMessage: "Verification requested via Chainlink CRE",
    pendingMessage: "Requesting decentralized biometric verification...",
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
        const hash = await requestTx.write({
          address: CONTRACTS.avalanche.biometricOracle,
          abi: BIOMETRIC_ORACLE_ABI,
          functionName: "requestVerification",
          args: [classId, threshold, duration],
        });

        // Store classId as temporary requestId for lookup
        setRequestId(classId);

        setIsVerifying(false);
        return hash;
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
        abi: INCENTIVE_ENGINE_ABI,
        functionName: "submitChainlinkProof",
        args: [classId],
      });
    },
    [claimTx]
  );

  /**
   * Check verification status from the BiometricOracle
   */
  const { data: verifiedScore, refetch: refetchStatus } = useReadContract({
    address: CONTRACTS.avalanche.biometricOracle,
    abi: BIOMETRIC_ORACLE_ABI,
    functionName: "getVerifiedScore",
    args: requestId && address ? [requestId, address] : undefined,
    query: {
      enabled: !!requestId && !!address,
    }
  });

  return {
    // Actions
    requestVerification,
    claimRewards,
    checkVerificationStatus: refetchStatus,

    // State
    isVerifying,
    isClaiming: claimTx.isPending,
    requestId,
    verifiedScore: verifiedScore ? Number(verifiedScore) : 0,
    isVerified: verifiedScore ? Number(verifiedScore) > 0 : false,
    isSuccess: claimTx.isSuccess,
    hash: claimTx.hash,
    error: requestTx.error || claimTx.error,

    // Config
    chainlinkConfig: CHAINLINK_CONFIG,
  };
}
