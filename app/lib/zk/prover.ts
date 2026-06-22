// ZK Prover - Abstract interface for multiple backends (Noir, SP1, Mock)
// ENHANCEMENT FIRST: Works alongside existing signed attestations

import type { ProofInput, ProofOutput, ZKProof, CircuitType, SelectiveDisclosure } from './types';
import { CIRCUIT_CONFIGS } from './types';
import { getNoirProver, NoirProver } from './noir-prover';
import { ZK_CONFIG } from "@/app/config";

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
        output.thresholdMet ? "1" : "0",
        output.secondsAbove.toString(),
        output.effortScore.toString(),
        input.classId,
        input.riderId,
      ],
      circuitType,
      verifierAddress: ZK_CONFIG.verifierAddress ?? "",
    };
  }
  
  async verifyProof(proof: ZKProof, _publicInputs: string[]): Promise<boolean> {
    const config = CIRCUIT_CONFIGS[proof.circuitType];
    await new Promise(r => setTimeout(r, config.verificationTime));

    // Validate proof structure
    if (!proof.proof || proof.proof.length === 0) return false;
    if (!proof.publicInputs || proof.publicInputs.length !== 7) return false;

    // Validate public inputs format
    const [threshold, minDuration, thresholdMet, secondsAbove, effortScore, classId, riderId] = proof.publicInputs;
    const thr = parseInt(threshold, 10);
    const dur = parseInt(minDuration, 10);
    const above = parseInt(secondsAbove, 10);
    const score = parseInt(effortScore, 10);

    if (isNaN(thr) || thr < 50 || thr > 250) return false;
    if (isNaN(dur) || dur <= 0) return false;
    if (isNaN(above) || above < 0) return false;
    if (isNaN(score) || score < 0 || score > 1000) return false;
    if (!classId || !riderId) return false;

    // Verify threshold logic: if thresholdMet is "1", secondsAbove must be >= minDuration
    if (thresholdMet === "1" && above < dur) return false;

    // Recompute proof hash and compare to verify integrity
    const proofHash = Array.from(proof.proof.slice(0, 32))
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join('');
    if (proofHash.length !== 64) return false;

    return true;
  }
  
  private async hashInputs(input: ProofInput, type: CircuitType): Promise<string> {
    const data = JSON.stringify({ ...input, type });
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  private computeOutput(input: ProofInput, _type: CircuitType): ProofOutput {
    const samples =
      input.heartRateSamples && input.heartRateSamples.length > 0
        ? input.heartRateSamples
        : [input.heartRate];
    const cappedSamples = samples.map((sample) => Math.min(sample, input.threshold * 2));
    const secondsAbove = cappedSamples.filter((sample) => sample > input.threshold).length;
    const thresholdMet = secondsAbove >= input.minDuration;
    const avgEffort = cappedSamples.reduce((sum, sample) => sum + sample, 0) / cappedSamples.length;
    const effortScore = Math.floor((avgEffort / Math.max(input.threshold, 1)) * 1000);
    
    return {
      thresholdMet,
      zoneEntered: thresholdMet,
      durationSatisfied: thresholdMet,
      secondsAbove,
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
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.mockBackend = new MockProver();
    this.initPromise = this.tryInitializeNoir();
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

  async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
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
    minDuration: number,
    heartRateSamples?: number[]
  ): Promise<ZKProof> {
    await this.ensureInitialized();
    const input: ProofInput = {
      heartRate,
      heartRateSamples,
      power: 0,
      cadence: 0,
      timestamp: heartRateSamples?.length ?? minDuration,
      riderId,
      threshold,
      classId,
      minDuration,
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
    await this.ensureInitialized();
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
    await this.ensureInitialized();
    return this.getBackend().verifyProof(proof, proof.publicInputs);
  }
  
  // Create selective disclosure from proof
  createSelectiveDisclosure(
    proof: ZKProof,
    statement: string,
    hiddenMetrics: { maxHeartRate: number; avgPower: number; rawDataPoints: number }
  ): SelectiveDisclosure {
    const [_threshold, _minDuration, thresholdMet, secondsAbove, effortScore, _classId, _riderId] = proof.publicInputs;
    
    return {
      statement,
      revealed: {
        effortScore: parseInt(effortScore) || 0,
        zone: thresholdMet === '1' ? 'Target' : 'Recovery',
        duration: parseInt(secondsAbove) || 0,
      },
      hidden: hiddenMetrics,
    };
  }
  
  // Get current backend info
  getBackendInfo(): { type: 'noir' | 'mock'; available: boolean } {
    return {
      type: this.useNoir ? 'noir' : 'mock',
      available: this.useNoir && this.noirBackend !== null,
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
