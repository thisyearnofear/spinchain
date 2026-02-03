// ZK Prover - Abstract interface for multiple backends (Noir, SP1, Mock)
// ENHANCEMENT FIRST: Works alongside existing signed attestations

import type { ProofInput, ProofOutput, ZKProof, CircuitType, SelectiveDisclosure } from './types';
import { CIRCUIT_CONFIGS } from './types';
import { getNoirProver, NoirProver } from './noir-prover';

// Prover backend interface
interface ProverBackend {
  generateProof(input: ProofInput, circuitType: CircuitType): Promise<ZKProof>;
  verifyProof(proof: ZKProof, publicInputs: string[]): Promise<boolean>;
}

// Mock prover for development (simulates Noir/SP1)
class MockProver implements ProverBackend {
  async generateProof(input: ProofInput, circuitType: CircuitType): Promise<ZKProof> {
    const config = CIRCUIT_CONFIGS[circuitType];
    await new Promise(r => setTimeout(r, config.provingTime));
    
    const proofData = await this.hashInputs(input, circuitType);
    const output = this.computeOutput(input, circuitType);
    
    return {
      proof: new TextEncoder().encode(proofData),
      publicInputs: [
        input.threshold.toString(),
        input.minDuration.toString(),
        output.thresholdMet.toString(),
        output.durationSatisfied.toString(),
        output.effortScore.toString(),
        input.classId,
        input.riderId,
      ],
      circuitType,
      verifierAddress: process.env.NEXT_PUBLIC_MOCK_VERIFIER_ADDRESS || '0xMOCK_VERIFIER',
    };
  }
  
  async verifyProof(proof: ZKProof, publicInputs: string[]): Promise<boolean> {
    const config = CIRCUIT_CONFIGS[proof.circuitType];
    await new Promise(r => setTimeout(r, config.verificationTime));
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
    
    const hrRatio = Math.min(input.heartRate / input.threshold, 2);
    const powerRatio = input.power > 0 ? Math.min(input.power / 200, 2) : 1;
    const effortScore = Math.floor(hrRatio * powerRatio * 250);
    
    return {
      thresholdMet,
      zoneEntered: thresholdMet,
      durationSatisfied,
      effortScore: Math.min(effortScore, 1000),
      proofHash: '',
    };
  }
}

// Main ZK Prover class with automatic backend selection
export class ZKProver {
  private mockBackend: MockProver;
  private noirBackend: NoirProver | null = null;
  private useNoir: boolean = false;
  
  constructor() {
    this.mockBackend = new MockProver();
    this.tryInitializeNoir();
  }
  
  private async tryInitializeNoir(): Promise<void> {
    try {
      this.noirBackend = await getNoirProver();
      this.useNoir = this.noirBackend.isAvailable();
      console.log(`[ZKProver] Using ${this.useNoir ? 'Noir' : 'Mock'} backend`);
    } catch (error) {
      console.warn('[ZKProver] Noir initialization failed, using Mock:', error);
      this.useNoir = false;
    }
  }
  
  private getBackend(): ProverBackend {
    return this.useNoir && this.noirBackend ? this.noirBackend : this.mockBackend;
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
      power: 0,
      cadence: 0,
      timestamp: duration,
      riderId,
      threshold,
      classId,
      minDuration: duration,
    };
    
    return this.getBackend().generateProof(input, 'effort_threshold');
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
      threshold: thresholds.hr,
      classId,
      minDuration: duration,
    };
    
    return this.getBackend().generateProof(input, 'composite');
  }
  
  // Verify any proof
  async verify(proof: ZKProof): Promise<boolean> {
    return this.getBackend().verifyProof(proof, proof.publicInputs);
  }
  
  // Create selective disclosure from proof
  createSelectiveDisclosure(
    proof: ZKProof,
    statement: string,
    hiddenMetrics: { maxHeartRate: number; avgPower: number; rawDataPoints: number }
  ): SelectiveDisclosure {
    const [threshold, minDuration, thresholdMet, secondsAbove, effortScore, classId, riderId] = proof.publicInputs;
    
    return {
      statement,
      revealed: {
        effortScore: parseInt(effortScore) || 0,
        zone: thresholdMet === 'true' ? 'Target' : 'Recovery',
        duration: parseInt(secondsAbove) || 0,
      },
      hidden: hiddenMetrics,
    };
  }
  
  // Get current backend info
  getBackendInfo(): { type: 'noir' | 'mock'; available: boolean } {
    return {
      type: this.useNoir ? 'noir' : 'mock',
      available: this.useNoir || true,
    };
  }
  
  // Force backend (for testing)
  setUseNoir(use: boolean): void {
    this.useNoir = use && this.noirBackend !== null;
  }
}

// Singleton instance
let proverInstance: ZKProver | null = null;

export function getProver(): ZKProver {
  if (!proverInstance) {
    proverInstance = new ZKProver();
  }
  return proverInstance;
}

// React hook for using ZK prover
export function useZKProver() {
  const prover = getProver();
  
  return {
    prover,
    configs: CIRCUIT_CONFIGS,
    backendInfo: prover.getBackendInfo(),
  };
}
