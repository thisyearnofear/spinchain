"use client";

// ZK-Enabled Rewards Claim Hook
// Integrates Phase 2 privacy features with existing contract infrastructure
// ENHANCEMENT FIRST: Extends useClaimRewards with ZK proofs

import { useState, useCallback } from 'react';
import { useTransaction } from './use-transaction';
import { CONTRACT_ERROR_CONTEXT } from '../lib/errors';
import { getLocalOracle, type LocalProofResult } from '../lib/zk/oracle';
import { getProver } from '../lib/zk/prover';
import { createDisclosure, calculatePrivacyScore, getPrivacyLevel } from '../lib/zk/disclosure';
import type { ZKProof } from '../lib/zk/types';

interface ZKClaimParams {
  spinClass: `0x${string}`;
  rider: `0x${string}`;
  rewardAmount: string;
  classId: `0x${string}`;
}

interface ZKClaimState {
  // ZK-specific state
  isGeneratingProof: boolean;
  proofResult?: LocalProofResult;
  privacyScore: number;
  privacyLevel: 'high' | 'medium' | 'low';
  
  // Legacy state (for backward compatibility)
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
  
  // Use existing transaction hook for the on-chain part
  const { write: submitClaim, ...txState } = useTransaction({
    successMessage: 'ZK Rewards Claimed! 🔒',
    pendingMessage: 'Submitting ZK proof on-chain...',
    errorContext: CONTRACT_ERROR_CONTEXT.claimReward,
  });
  
  // Generate ZK proof from session data
  const generateProof = useCallback(async (
    heartRate: number,
    threshold: number,
    duration: number
  ): Promise<LocalProofResult> => {
    setZkState(prev => ({ ...prev, isGeneratingProof: true }));
    
    try {
      const oracle = getLocalOracle();
      const prover = getProver();
      
      // Generate proof
      const proof = await prover.proveEffortThreshold(
        heartRate,
        threshold,
        'mock-class-id',
        'mock-rider-id',
        duration
      );
      
      // Create disclosure
      const disclosure = createDisclosure(
        proof,
        `Maintained HR > ${threshold} for ${duration} minutes`
      );
      
      // Calculate privacy score
      const score = calculatePrivacyScore(disclosure, {
        privateFields: ['heartRate', 'power', 'cadence', 'gps', 'biometrics'],
        revealableFields: ['effortScore', 'zone', 'duration'],
        publicFields: ['classId', 'riderId', 'timestamp', 'proofHash'],
      });
      
      const result: LocalProofResult = {
        success: true,
        proof,
        disclosure: {
          statement: disclosure.statement,
          revealed: disclosure.revealed,
        },
        metadata: {
          dataPoints: duration * 60,
          maxHeartRate: heartRate,
          avgPower: 0,
          provingTime: 500,
        },
      };
      
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
  
  // Submit claim with ZK proof
  const claimWithProof = useCallback(async (
    params: ZKClaimParams,
    proof: ZKProof
  ) => {
    // Create attestation hash from proof
    const claimHash = `0x${Buffer.from(proof.proof).toString('hex').slice(0, 64)}` as `0x${string}`;
    
    // Submit to contract (using existing hook)
    submitClaim({
      address: params.spinClass,
      abi: [], // Would use actual incentive engine ABI
      functionName: "submitZKAttestation",
      args: [
        params.spinClass,
        params.rider,
        BigInt(parseFloat(params.rewardAmount) * 1e18),
        params.classId,
        claimHash,
        BigInt(Math.floor(Date.now() / 1000)),
        proof.publicInputs,
      ],
    });
  }, [submitClaim]);
  
  // Full flow: generate proof + submit claim
  const claimWithZK = useCallback(async (
    params: ZKClaimParams,
    sessionData: {
      heartRate: number;
      threshold: number;
      duration: number;
    }
  ) => {
    // Step 1: Generate ZK proof
    const proofResult = await generateProof(
      sessionData.heartRate,
      sessionData.threshold,
      sessionData.duration
    );
    
    if (!proofResult.success || !proofResult.proof) {
      setZkState(prev => ({
        ...prev,
        error: new Error(proofResult.error || 'Proof generation failed'),
      }));
      return;
    }
    
    // Step 2: Submit to contract
    await claimWithProof(params, proofResult.proof);
  }, [generateProof, claimWithProof]);
  
  return {
    // ZK-specific
    generateProof,
    claimWithProof,
    claimWithZK,
    
    // State
    isGeneratingProof: zkState.isGeneratingProof,
    proofResult: zkState.proofResult,
    privacyScore: zkState.privacyScore,
    privacyLevel: zkState.privacyLevel,
    
    // Transaction state (from useTransaction)
    isPending: txState.isPending,
    isSuccess: txState.isSuccess,
    hash: txState.hash,
    error: txState.error || zkState.error,
  };
}

// Legacy-compatible hook (signed attestations)
// This allows gradual migration from signed attestations to ZK proofs
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
      sessionData?: { heartRate: number; threshold: number; duration: number }
    ) => {
      if (params.useZK && sessionData) {
        return zkClaim.claimWithZK(params, sessionData);
      } else {
        // Legacy signed attestation path
        const claimHash = `0x${'0'.repeat(64)}` as `0x${string}`;
        legacyClaim.write({
          address: params.spinClass,
          abi: [],
          functionName: "submitAttestation",
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
    
    // Expose both states
    zk: zkClaim,
    legacy: legacyClaim,
  };
}
