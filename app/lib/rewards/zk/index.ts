/**
 * ZK Rewards Integration
 * 
 * Consolidated from useZKClaim hook
 * Provides ZK proof generation for batch reward claims
 */

"use client";

import { useState, useCallback } from "react";
import type { ZKProofInput, ZKProofResult, PrivacyDisclosure } from "../types";
import { calculateEffortScore } from "../calculator";
import { getLocalOracle, type LocalProofResult } from "../../zk/oracle";
import { getProver } from "../../zk/prover";
import { createDisclosure, calculatePrivacyScore, getPrivacyLevel } from "../../zk/disclosure";

// ============================================================================
// Types
// ============================================================================

export interface UseZKRewardsReturn {
  generateProof: (input: ZKProofInput) => Promise<ZKProofResult>;
  isGenerating: boolean;
  lastResult?: ZKProofResult & { privacyScore: number; privacyLevel: string };
}

// ============================================================================
// Hook
// ============================================================================

export function useZKRewards(): UseZKRewardsReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<(ZKProofResult & { privacyScore: number; privacyLevel: string }) | undefined>();

  const generateProof = useCallback(async (input: ZKProofInput): Promise<ZKProofResult> => {
    setIsGenerating(true);

    try {
      const oracle = getLocalOracle();
      const prover = getProver();

      // Calculate effort score
      const effortScore = calculateEffortScore({
        heartRate: input.heartRate,
        power: 0, // ZK mode doesn't require power
        durationSeconds: input.duration * 60,
      });

      // Generate proof
      const proof = await prover.proveEffortThreshold(
        input.heartRate,
        input.threshold,
        input.classId,
        input.riderId,
        input.duration
      );

      // Create disclosure
      const disclosure: PrivacyDisclosure = createDisclosure(
        proof,
        `Maintained HR > ${input.threshold} for ${input.duration} minutes`
      );

      // Calculate privacy score
      const privacyScore = calculatePrivacyScore(disclosure, {
        privateFields: ["heartRate", "power", "cadence", "gps", "biometrics"],
        revealableFields: ["effortScore", "zone", "duration"],
        publicFields: ["classId", "riderId", "timestamp", "proofHash"],
      });

      const result: ZKProofResult = {
        success: true,
        proof,
        effortScore,
      };

      setLastResult({
        ...result,
        privacyScore,
        privacyLevel: getPrivacyLevel(privacyScore),
      });

      setIsGenerating(false);
      return result;
    } catch (error) {
      const result: ZKProofResult = {
        success: false,
        error: error instanceof Error ? error.message : "Proof generation failed",
      };
      setIsGenerating(false);
      return result;
    }
  }, []);

  return {
    generateProof,
    isGenerating,
    lastResult,
  };
}

// ============================================================================
// Batch Accumulation (for ZK batch mode)
// ============================================================================

export interface BatchAccumulator {
  telemetryPoints: Array<{ heartRate: number; power: number; timestamp: number }>;
  totalDuration: number;
  maxHeartRate: number;
  avgPower: number;
}

export function createBatchAccumulator(): BatchAccumulator {
  return {
    telemetryPoints: [],
    totalDuration: 0,
    maxHeartRate: 0,
    avgPower: 0,
  };
}

export function addToBatch(
  batch: BatchAccumulator,
  heartRate: number,
  power: number
): BatchAccumulator {
  const now = Date.now();
  const newPoints = [...batch.telemetryPoints, { heartRate, power, timestamp: now }];
  
  // Recalculate stats
  const duration = newPoints.length > 1 
    ? (now - newPoints[0].timestamp) / 1000 
    : 0;
  
  const maxHR = Math.max(...newPoints.map(p => p.heartRate));
  const avgPwr = newPoints.reduce((sum, p) => sum + p.power, 0) / newPoints.length;

  return {
    telemetryPoints: newPoints,
    totalDuration: duration,
    maxHeartRate: maxHR,
    avgPower: avgPwr,
  };
}

export function prepareZKInputFromBatch(
  batch: BatchAccumulator,
  classId: string,
  riderId: string,
  threshold: number
): ZKProofInput {
  return {
    heartRate: batch.maxHeartRate,
    threshold,
    duration: Math.floor(batch.totalDuration / 60), // Convert to minutes
    classId,
    riderId,
  };
}
