"use client";

// ZK-Enabled Rewards Claim Hook with On-Chain Verification
// Integrates Noir proofs with Avalanche verification

import { useState, useCallback, useMemo } from 'react';
import { useTransaction } from './use-transaction';
import { CONTRACT_ERROR_CONTEXT } from '@/app/lib/errors';
import { getLocalOracle, type LocalProofResult } from '@/app/lib/zk/oracle';
import { createDisclosure, calculatePrivacyScore, getPrivacyLevel } from '@/app/lib/zk/disclosure';
import { INCENTIVE_ENGINE_ABI, INCENTIVE_ENGINE_ADDRESS } from "@/app/lib/contracts";
import type { ZKProof } from '@/app/lib/zk/types';
import { encodePacked, keccak256 } from 'viem';

interface ZKClaimParams {
  spinClass: `0x${string}`;
  rider: `0x${string}`;
  rewardAmount: string;
  classId: `0x${string}`;
}

interface ZKClaimState {
  isGeneratingProof: boolean;
  proofResult?: LocalProofResult;
  privacyScore: number;
  privacyLevel: 'high' | 'medium' | 'low';
  isPending: boolean;
  isSuccess: boolean;
  hash?: `0x${string}`;
  error: Error | null;
}

export function useZKClaim() {
  const [zkState, setZkState] = useState<ZKClaimState>({
    isGeneratingProof: false,
    privacyScore: 0,
    privacyLevel: 'low',
    isPending: false,
    isSuccess: false,
    error: null,
  });
  
  // Use IncentiveEngine for on-chain verification + mint
  const transactionOptions = useMemo(() => ({
    successMessage: 'ZK reward claimed on-chain',
    pendingMessage: 'Submitting ZK reward claim...',
    errorContext: CONTRACT_ERROR_CONTEXT.claimReward,
  }), []);

  const { write: submitToEngine, ...txState } = useTransaction(transactionOptions);
  
  // Generate ZK proof from session data
  const generateProof = useCallback(async (
    sessionData: {
      heartRate: number;
      threshold: number;
      durationSeconds: number;
      classId: string;
      riderId: string;
      heartRateSamples?: number[];
      avgPower?: number;
    }
  ): Promise<LocalProofResult> => {
    setZkState(prev => ({ ...prev, isGeneratingProof: true }));
    
    try {
      const oracle = getLocalOracle();
      const samples =
        sessionData.heartRateSamples && sessionData.heartRateSamples.length > 0
          ? sessionData.heartRateSamples
          : Array.from(
              { length: Math.max(1, sessionData.durationSeconds) },
              () => sessionData.heartRate,
            );

      const result = await oracle.generateProofsFromHeartRateSamples({
        heartRateSamples: samples,
        avgPower: sessionData.avgPower,
        classId: sessionData.classId,
        riderId: sessionData.riderId,
        threshold: sessionData.threshold,
        minDuration: sessionData.durationSeconds,
      });

      if (!result.success || !result.proof) {
        throw new Error(result.error || "Proof generation failed");
      }

      const disclosure = createDisclosure(
        result.proof,
        `Maintained HR > ${sessionData.threshold} for ${Math.round(sessionData.durationSeconds / 60)} minutes`
      );
      
      // Calculate privacy score
      const score = calculatePrivacyScore(disclosure, {
        privateFields: ['heartRate', 'power', 'cadence', 'gps', 'biometrics'],
        revealableFields: ['effortScore', 'zone', 'duration'],
        publicFields: ['classId', 'riderId', 'timestamp', 'proofHash'],
      });
      
      setZkState(prev => ({
        ...prev,
        isGeneratingProof: false,
        proofResult: result,
        privacyScore: score,
        privacyLevel: getPrivacyLevel(score),
      }));
      
      return result;
    } catch (error) {
      const result: LocalProofResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Proof generation failed',
      };
      
      setZkState(prev => ({
        ...prev,
        isGeneratingProof: false,
        proofResult: result,
      }));
      
      return result;
    }
  }, []);
  
  // Submit proof to on-chain verifier
  const submitProof = useCallback(async (
    params: ZKClaimParams,
    proof: ZKProof,
    proofs?: ZKProof[],
    minTotalSeconds?: number,
  ) => {
    if (!INCENTIVE_ENGINE_ADDRESS) {
      throw new Error("IncentiveEngine is not configured");
    }

    if (proofs && proofs.length > 1) {
      submitToEngine({
        address: INCENTIVE_ENGINE_ADDRESS,
        abi: INCENTIVE_ENGINE_ABI,
        functionName: 'submitZKProofBatch',
        args: [
          proofs.map((item) => `0x${Buffer.from(item.proof).toString('hex')}` as `0x${string}`),
          proofs.map((item) => encodePublicInputs(item.publicInputs)),
          minTotalSeconds ?? 0,
        ],
      });
      return;
    }

    submitToEngine({
      address: INCENTIVE_ENGINE_ADDRESS,
      abi: INCENTIVE_ENGINE_ABI,
      functionName: 'submitZKProof',
      args: [
        `0x${Buffer.from(proof.proof).toString('hex')}` as `0x${string}`,
        encodePublicInputs(proof.publicInputs),
      ],
    });
  }, [submitToEngine]);
  
  // Full flow: generate proof + submit to verifier
  const claimWithZK = useCallback(async (
    params: ZKClaimParams,
    sessionData: {
      heartRate: number;
      threshold: number;
      durationSeconds: number;
      heartRateSamples?: number[];
      avgPower?: number;
    }
  ) => {
    // Step 1: Generate ZK proof
    const proofResult = await generateProof(
      {
        heartRate: sessionData.heartRate,
        threshold: sessionData.threshold,
        durationSeconds: sessionData.durationSeconds,
        classId: params.classId,
        riderId: params.rider,
        heartRateSamples: sessionData.heartRateSamples,
        avgPower: sessionData.avgPower,
      }
    );
    
    if (!proofResult.success || !proofResult.proof) {
      setZkState(prev => ({
        ...prev,
        error: new Error(proofResult.error || 'Proof generation failed'),
      }));
      return;
    }
    
    // Step 2: Submit to IncentiveEngine for verification + mint
    await submitProof(
      params,
      proofResult.proof,
      proofResult.proofs,
      sessionData.durationSeconds,
    );
  }, [generateProof, submitProof]);
  
  // Check if proof was already used (prevents replay)
  const checkProofUsed = useCallback(async (_proofHash: `0x${string}`): Promise<boolean> => {
    // This would use useReadContract in a real implementation
    // For now, return false
    return false;
  }, []);
  
  return {
    // Actions
    generateProof,
    submitProof,
    claimWithZK,
    checkProofUsed,
    
    // State
    isGeneratingProof: zkState.isGeneratingProof,
    proofResult: zkState.proofResult,
    privacyScore: zkState.privacyScore,
    privacyLevel: zkState.privacyLevel,
    
    // Transaction state
    isPending: txState.isPending,
    isSuccess: txState.isSuccess,
    hash: txState.hash,
    error: txState.error || zkState.error,
  };
}

// Legacy-compatible hook (signed attestations with ZK upgrade path)
export function useHybridClaim() {
  const zkClaim = useZKClaim();
  const legacyClaim = useTransaction({
    successMessage: 'Rewards Claimed!',
    pendingMessage: 'Submitting claim...',
    errorContext: CONTRACT_ERROR_CONTEXT.claimReward,
  });
  
  return {
    // Use ZK if available, fall back to signed attestation
    claim: async (
      params: ZKClaimParams & { useZK?: boolean },
      sessionData?: {
        heartRate: number;
        threshold: number;
        durationSeconds: number;
        heartRateSamples?: number[];
        avgPower?: number;
      }
    ) => {
      if (params.useZK && sessionData) {
        return zkClaim.claimWithZK(params, sessionData);
      } else {
        // Legacy signed attestation path
        const claimHash = keccak256(encodePacked(['string'], ['LEGACY_CLAIM']));
        legacyClaim.write({
          address: params.spinClass,
          abi: [],
          functionName: 'submitAttestation',
          args: [
            params.spinClass,
            params.rider,
            BigInt(parseFloat(params.rewardAmount) * 1e18),
            params.classId,
            claimHash,
            BigInt(Math.floor(Date.now() / 1000)),
            '0x00',
          ],
        });
      }
    },
    
    // Expose both
    zk: zkClaim,
    legacy: legacyClaim,
  };
}

function encodePublicInputs(values: string[]): `0x${string}`[] {
  return values.map((value) => {
    if (value === "true") value = "1";
    if (value === "false") value = "0";
    if (value.startsWith("0x")) {
      return `0x${value.slice(2).padStart(64, '0')}` as `0x${string}`;
    }

    const num = BigInt(value);
    return `0x${num.toString(16).padStart(64, '0')}` as `0x${string}`;
  });
}
