"use client";

// ZK-Enabled Rewards Claim Hook with On-Chain Verification
// Integrates Noir proofs with Avalanche verification

import { useState, useCallback } from 'react';
import { useTransaction } from './use-transaction';
import { CONTRACT_ERROR_CONTEXT } from '../lib/errors';
import { getLocalOracle, type LocalProofResult } from '../lib/zk/oracle';
import { getProver } from '../lib/zk/prover';
import { createDisclosure, calculatePrivacyScore, getPrivacyLevel } from '../lib/zk/disclosure';
import { EFFORT_THRESHOLD_VERIFIER_ADDRESS, EFFORT_THRESHOLD_VERIFIER_ABI } from '../lib/contracts/verifier';
import type { ZKProof } from '../lib/zk/types';
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
  
  // Use verifier contract for on-chain verification
  const { write: submitToVerifier, ...txState } = useTransaction({
    successMessage: 'ZK Proof Verified On-Chain! 🔒',
    pendingMessage: 'Verifying proof on Avalanche...',
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
      
      // Generate proof using Noir (or mock if unavailable)
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
  
  // Submit proof to on-chain verifier
  const submitProof = useCallback(async (
    params: ZKClaimParams,
    proof: ZKProof
  ) => {
    // Convert proof bytes to hex
    const proofHex = `0x${Buffer.from(proof.proof).toString('hex')}` as `0x${string}`;
    
    // Encode public inputs for contract
    const publicInputs = proof.publicInputs.map(v => {
      // Convert to bytes32
      const num = BigInt(v);
      return `0x${num.toString(16).padStart(64, '0')}` as `0x${string}`;
    });
    
    // Submit to verifier contract
    submitToVerifier({
      address: EFFORT_THRESHOLD_VERIFIER_ADDRESS,
      abi: EFFORT_THRESHOLD_VERIFIER_ABI,
      functionName: 'verifyAndRecord',
      args: [proofHex, publicInputs],
    });
  }, [submitToVerifier]);
  
  // Full flow: generate proof + submit to verifier
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
    
    // Step 2: Submit to on-chain verifier
    await submitProof(params, proofResult.proof);
  }, [generateProof, submitProof]);
  
  // Check if proof was already used (prevents replay)
  const checkProofUsed = useCallback(async (proofHash: `0x${string}`): Promise<boolean> => {
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
      sessionData?: { heartRate: number; threshold: number; duration: number }
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
