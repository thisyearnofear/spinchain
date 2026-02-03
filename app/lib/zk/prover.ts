// ZK Prover - Abstract interface for multiple backends (Noir, SP1, Mock)
// ENHANCEMENT FIRST: Works alongside existing signed attestations

import type { ProofInput, ProofOutput, ZKProof, CircuitType, SelectiveDisclosure } from './types';
import { CIRCUIT_CONFIGS } from './types';

// Prover backend interface
interface ProverBackend {
  generateProof(input: ProofInput, circuitType: CircuitType): Promise<ZKProof>;
  verifyProof(proof: ZKProof, publicInputs: string[]): Promise<boolean>;
}

// Mock prover for development (simulates Noir/SP1)
class MockProver implements ProverBackend {
  async generateProof(input: ProofInput, circuitType: CircuitType): Promise<ZKProof> {
    // Simulate proving delay
    const config = CIRCUIT_CONFIGS[circuitType];
    await new Promise(r => setTimeout(r, config.provingTime));
    
    // Generate deterministic mock proof
    const proofData = await this.hashInputs(input, circuitType);
    
    // Compute public outputs
    const output = this.computeOutput(input, circuitType);
    
    return {
      proof: new TextEncoder().encode(proofData),
      publicInputs: [
        output.effortScore.toString(),
        output.thresholdMet.toString(),
        input.classId,
        input.riderId,
      ],
      circuitType,
      verifierAddress: '0xMOCK_VERIFIER',
    };
  }
  
  async verifyProof(proof: ZKProof, publicInputs: string[]): Promise<boolean> {
    // Simulate verification
    const config = CIRCUIT_CONFIGS[proof.circuitType];
    await new Promise(r => setTimeout(r, config.verificationTime));
    
    // Mock verification always succeeds for valid structure
    return proof.publicInputs.length > 0 && proof.proof.length > 0;
  }
  
  private async hashInputs(input: ProofInput, type: CircuitType): Promise<string> {
    const data = JSON.stringify({ ...input, type });
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  private computeOutput(input: ProofInput, type: CircuitType): ProofOutput {
    const thresholdMet = input.heartRate > input.threshold;
    const durationSatisfied = input.timestamp >= input.minDuration;
    
    // Calculate effort score (0-1000)
    const hrRatio = Math.min(input.heartRate / input.threshold, 2);
    const powerRatio = input.power > 0 ? Math.min(input.power / 200, 2) : 1;
    const effortScore = Math.floor(hrRatio * powerRatio * 250);
    
    return {
      thresholdMet,
      zoneEntered: thresholdMet,
      durationSatisfied,
      effortScore: Math.min(effortScore, 1000),
      proofHash: '', // Set by generateProof
    };
  }
}

// Main ZK Prover class
export class ZKProver {
  private backend: ProverBackend;
  
  constructor(useMock = true) {
    // In production, this would instantiate Noir or SP1
    this.backend = useMock ? new MockProver() : new MockProver();
  }
  
  // Generate a proof for effort threshold
  async proveEffortThreshold(
    heartRate: number,
    threshold: number,
    classId: string,
    riderId: string,
    duration: number
  ): Promise<ZKProof> {
    const input: ProofInput = {
      heartRate,
      power: 0, // Not used for HR threshold
      cadence: 0,
      timestamp: duration,
      riderId,
      threshold,
      classId,
      minDuration: duration,
    };
    
    return this.backend.generateProof(input, 'effort_threshold');
  }
  
  // Generate composite proof (HR + Power + Cadence)
  async proveComposite(
    heartRate: number,
    power: number,
    cadence: number,
    thresholds: { hr: number; power: number; cadence: number },
    classId: string,
    riderId: string,
    duration: number
  ): Promise<ZKProof> {
    const input: ProofInput = {
      heartRate,
      power,
      cadence,
      timestamp: duration,
      riderId,
      threshold: thresholds.hr, // Primary threshold
      classId,
      minDuration: duration,
    };
    
    return this.backend.generateProof(input, 'composite');
  }
  
  // Verify any proof
  async verify(proof: ZKProof): Promise<boolean> {
    return this.backend.verifyProof(proof, proof.publicInputs);
  }
  
  // Create selective disclosure from proof
  createSelectiveDisclosure(
    proof: ZKProof,
    statement: string,
    hiddenMetrics: { maxHeartRate: number; avgPower: number; rawDataPoints: number }
  ): SelectiveDisclosure {
    const [effortScore, thresholdMet, classId] = proof.publicInputs;
    
    return {
      statement,
      revealed: {
        effortScore: parseInt(effortScore) || 0,
        zone: thresholdMet === 'true' ? 'Target' : 'Recovery',
        duration: 0, // Would come from metadata
      },
      hidden: hiddenMetrics,
    };
  }
}

// Singleton instance
let proverInstance: ZKProver | null = null;

export function getProver(useMock = true): ZKProver {
  if (!proverInstance) {
    proverInstance = new ZKProver(useMock);
  }
  return proverInstance;
}

// React hook for using ZK prover
export function useZKProver() {
  const prover = getProver(true); // Mock for now
  
  return {
    prover,
    configs: CIRCUIT_CONFIGS,
  };
}
