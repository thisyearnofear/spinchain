// Noir Prover - Production ZK proof generation using real Noir circuits
// Uses @noir-lang/noir_js + @noir-lang/backend_barretenberg

import type { ProofInput, ZKProof, CircuitType } from './types';
import { ZK_CONFIG } from "@/app/config";

// Lazily-loaded module references (browser only)
 
let BackendCtor: any = null;
 
let NoirCtor: any = null;

// Compiled circuit shape from Nargo
interface CompiledCircuit {
  bytecode: string;
  abi: unknown;
}

// ProofData shape returned by BarretenbergBackend
interface ProofData {
  proof: Uint8Array;
  publicInputs: string[];
}

// Browser-compatible Noir prover using @noir-lang packages
export class NoirProver {
   
  private backend: any = null;
   
  private noir: any = null;
  private circuit: CompiledCircuit | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Dynamic imports — only run in browser, not during SSR/build
      if (typeof window === 'undefined') {
        console.warn('[NoirProver] Not in browser, skipping initialization');
        return;
      }

      if (!BackendCtor || !NoirCtor) {
        const backendMod = await import(/* webpackIgnore: true */ '@noir-lang/backend_barretenberg');
        const noirMod = await import(/* webpackIgnore: true */ '@noir-lang/noir_js');
        BackendCtor = backendMod.BarretenbergBackend;
        NoirCtor = noirMod.Noir;
      }

      // Load compiled circuit from public directory
      await this.loadCircuit();

      if (!this.circuit) {
        console.warn('[NoirProver] Circuit not loaded, falling back to mock');
        return;
      }

      // Initialize backend and Noir
      this.backend = new BackendCtor(this.circuit);
      this.noir = new NoirCtor(this.circuit);
      await this.noir.init();

      this.initialized = true;
      console.log('[NoirProver] Initialized successfully with BarretenbergBackend');
    } catch (error) {
      console.error('[NoirProver] Initialization failed:', error);
      this.initialized = false;
    }
  }
  
  private async loadCircuit(): Promise<void> {
    try {
      const response = await fetch('/circuits/effort_threshold/target/effort_threshold.json');
      if (response.ok) {
        const circuitJson = await response.json() as CompiledCircuit;
        if (circuitJson.bytecode && circuitJson.abi) {
          this.circuit = circuitJson;
          console.log('[NoirProver] Circuit loaded successfully');
        } else {
          console.warn('[NoirProver] Circuit JSON missing bytecode or abi');
        }
      } else {
        console.warn('[NoirProver] Circuit not found at /circuits/...');
      }
    } catch (error) {
      console.warn('[NoirProver] Circuit load failed:', error);
    }
  }
  
  async generateProof(
    input: ProofInput,
    circuitType: CircuitType
  ): Promise<ZKProof> {
    if (!this.initialized || !this.backend || !this.noir) {
      throw new Error('Noir prover not initialized');
    }

    // Build circuit inputs — circuit expects a single struct argument
    const MAX_POINTS = 60;
    const heartRates: number[] = new Array(MAX_POINTS).fill(0);

    const samples =
      input.heartRateSamples && input.heartRateSamples.length > 0
        ? input.heartRateSamples.slice(0, MAX_POINTS)
        : [input.heartRate];
    const numPoints = Math.min(samples.length, MAX_POINTS);
    for (let i = 0; i < numPoints; i++) {
      heartRates[i] = Math.max(0, Math.floor(samples[i]));
    }

    const circuitInputs = {
      input: {
        heart_rates: heartRates,
        num_points: numPoints,
        threshold: Math.max(50, Math.min(250, Math.floor(input.threshold))),
        min_duration: Math.floor(input.minDuration),
      },
    };

    // Execute circuit to get witness
    const startTime = performance.now();
    const { witness } = await this.noir.execute(circuitInputs);

    // Generate proof from witness
    const proofData: ProofData = await this.backend.generateProof(witness);
    const provingTime = performance.now() - startTime;

    console.log(`[NoirProver] Proof generated in ${provingTime.toFixed(0)}ms`);

    // Circuit returns: [threshold_met (bool), seconds_above (u32), effort_score (u16)]
    // Map to the 7-element format expected by ZKProof consumers:
    // [threshold, minDuration, thresholdMet, secondsAbove, effortScore, classId, riderId]
    const rawOutputs = proofData.publicInputs;
    const thresholdMet = rawOutputs[0] === 'true' || rawOutputs[0] === '1' ? '1' : '0';
    const secondsAbove = rawOutputs[1] ?? '0';
    const effortScore = rawOutputs[2] ?? '0';

    return {
      proof: proofData.proof,
      publicInputs: [
        String(Math.floor(input.threshold)),
        String(Math.floor(input.minDuration)),
        thresholdMet,
        secondsAbove,
        effortScore,
        input.classId,
        input.riderId,
      ],
      circuitType,
      verifierAddress: ZK_CONFIG.verifierAddress ?? "",
    };
  }

  async verifyProof(proof: ZKProof, _publicInputs: string[]): Promise<boolean> {
    if (!this.backend) {
      throw new Error('Noir prover not initialized');
    }

    const startTime = performance.now();
    // BarretenbergBackend.verifyProof takes ProofData { proof, publicInputs }
    // Our circuit has no public inputs (all in private struct), only public return values.
    // The circuit returns 3 public outputs: [threshold_met, seconds_above, effort_score]
    // In our 7-element ZKProof format, these are at indices 2-4.
    const proofData: ProofData = {
      proof: proof.proof,
      publicInputs: proof.publicInputs.slice(2, 5),
    };
    const valid = await this.backend.verifyProof(proofData);
    const verifyTime = performance.now() - startTime;

    console.log(`[NoirProver] Verification completed in ${verifyTime.toFixed(0)}ms`);

    return valid;
  }

  // Check if Noir is available (circuits compiled and loaded)
  isAvailable(): boolean {
    return this.initialized && this.circuit !== null;
  }
}

// Factory function with fallback
let noirProver: NoirProver | null = null;

export async function getNoirProver(): Promise<NoirProver> {
  if (!noirProver) {
    noirProver = new NoirProver();
    await noirProver.initialize();
  }
  return noirProver;
}
