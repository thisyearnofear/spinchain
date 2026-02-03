// Selective Disclosure System
// Prove statements about health data without revealing the raw values

import type { SelectiveDisclosure, ZKProof, ProofInput } from './types';
import { getProver } from './prover';

// Statement templates for common fitness proofs
export const STATEMENT_TEMPLATES = {
  heartRateThreshold: (threshold: number, duration: number) => 
    `Maintained heart rate above ${threshold} BPM for ${duration} minutes`,
    
  powerZone: (zone: string, duration: number) => 
    `Stayed in ${zone} power zone for ${duration} minutes`,
    
  cadenceRange: (min: number, max: number) => 
    `Maintained cadence between ${min}-${max} RPM`,
    
  compositeEffort: (score: number) => 
    `Achieved effort score above ${score}`,
    
  streak: (days: number) => 
    `Completed ${days} consecutive days of exercise`,
} as const;

// Disclosure policy - what can be revealed vs hidden
export interface DisclosurePolicy {
  // Always hidden (private)
  privateFields: ('heartRate' | 'power' | 'cadence' | 'gps' | 'biometrics')[];
  
  // Can be revealed with consent
  revealableFields: ('effortScore' | 'zone' | 'duration' | 'ranking')[];
  
  // Always public
  publicFields: ('classId' | 'riderId' | 'timestamp' | 'proofHash')[];
}

// Default privacy-first policy
export const DEFAULT_POLICY: DisclosurePolicy = {
  privateFields: ['heartRate', 'power', 'cadence', 'gps', 'biometrics'],
  revealableFields: ['effortScore', 'zone', 'duration'],
  publicFields: ['classId', 'riderId', 'timestamp', 'proofHash'],
};

// Disclosure builder for creating custom disclosures
export class DisclosureBuilder {
  private policy: DisclosurePolicy;
  private proof?: ZKProof;
  private statement?: string;
  private metadata: Record<string, unknown> = {};
  
  constructor(policy: DisclosurePolicy = DEFAULT_POLICY) {
    this.policy = policy;
  }
  
  withProof(proof: ZKProof): this {
    this.proof = proof;
    return this;
  }
  
  withStatement(statement: string): this {
    this.statement = statement;
    return this;
  }
  
  withMetadata(metadata: Record<string, unknown>): this {
    this.metadata = metadata;
    return this;
  }
  
  build(): SelectiveDisclosure {
    if (!this.proof) {
      throw new Error('Proof is required to build disclosure');
    }
    
    const [effortScoreStr, thresholdMetStr] = this.proof.publicInputs;
    const effortScore = parseInt(effortScoreStr) || 0;
    const thresholdMet = thresholdMetStr === 'true';
    
    // Extract what can be revealed based on policy
    const revealed: SelectiveDisclosure['revealed'] = {
      effortScore: this.policy.revealableFields.includes('effortScore') ? effortScore : 0,
      zone: this.policy.revealableFields.includes('zone') 
        ? (thresholdMet ? 'Target' : 'Recovery')
        : 'Hidden',
      duration: this.policy.revealableFields.includes('duration')
        ? (this.metadata.duration as number || 0)
        : 0,
    };
    
    // Hide sensitive data
    const hidden: SelectiveDisclosure['hidden'] = {
      maxHeartRate: this.policy.privateFields.includes('heartRate') ? 0 : 0,
      avgPower: this.policy.privateFields.includes('power') ? 0 : 0,
      rawDataPoints: 0, // Always hidden
    };
    
    return {
      statement: this.statement || 'Proof of effort submitted',
      revealed,
      hidden,
    };
  }
}

// Verification service for disclosures
export class DisclosureVerifier {
  async verify(disclosure: SelectiveDisclosure, proof: ZKProof): Promise<boolean> {
    const prover = getProver();
    
    // Verify the underlying proof
    const isValid = await prover.verify(proof);
    if (!isValid) return false;
    
    // Verify disclosure matches proof outputs
    const [effortScoreStr, thresholdMetStr] = proof.publicInputs;
    const effortScore = parseInt(effortScoreStr) || 0;
    
    // Check consistency
    if (disclosure.revealed.effortScore !== effortScore) {
      return false;
    }
    
    return true;
  }
}

// Privacy score calculator
export function calculatePrivacyScore(
  disclosure: SelectiveDisclosure,
  policy: DisclosurePolicy
): number {
  let score = 0;
  const maxScore = 100;
  
  // Points for hiding sensitive data
  if (disclosure.hidden.maxHeartRate === 0) score += 25;
  if (disclosure.hidden.avgPower === 0) score += 25;
  if (disclosure.hidden.rawDataPoints === 0) score += 25;
  
  // Points for minimal revelation
  const revealedCount = Object.values(disclosure.revealed).filter(v => 
    v !== 0 && v !== 'Hidden'
  ).length;
  score += Math.max(0, 25 - revealedCount * 5);
  
  return Math.min(score, maxScore);
}

// Export convenience functions
export function createDisclosure(
  proof: ZKProof,
  statement: string,
  policy?: DisclosurePolicy
): SelectiveDisclosure {
  return new DisclosureBuilder(policy)
    .withProof(proof)
    .withStatement(statement)
    .build();
}

export function getPrivacyLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}
