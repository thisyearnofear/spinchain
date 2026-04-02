// Noir Prover - Production ZK proof generation
// Replaces MockProver with actual Noir circuits

import type { ProofInput, ZKProof, CircuitType } from './types';
import { ZK_CONFIG } from "@/app/config";

// UltraPlonk backend interface (dynamically imported)
interface NoirBackend {
  generateProof(witness: unknown): Promise<{ proof: Uint8Array; publicInputs: string[] }>;
  verifyProof(proof: Uint8Array, publicInputs: string[]): Promise<boolean>;
}

// Browser-compatible Noir prover using @noir-lang packages
export class NoirProver {
  private backend: NoirBackend | null = null;
  private circuit: unknown = null;
  private initialized = false;
  
  // Circuit bytecode (compiled from Nargo)
  private circuitBytecode: Uint8Array | null = null;
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Dynamic import using string literals to prevent TypeScript from checking
      const backendPkg = '@noir-lang/backend_barretenberg';
      const noirPkg = '@noir-lang/noir_js';
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const backendModule = await (eval(`import('${backendPkg}')`) as Promise<any>).catch(() => null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const noirModule = await (eval(`import('${noirPkg}')`) as Promise<any>).catch(() => null);
      
      if (!backendModule || !noirModule) {
        console.warn('[NoirProver] Noir packages not installed, falling back to mock');
        this.initialized = false;
        return;
      }
      
      // Load circuit (in production, fetch from server or CDN)
      await this.loadCircuit();
      
      if (!this.circuitBytecode) {
        console.warn('[NoirProver] Circuit not loaded, falling back to mock');
        this.initialized = false;
        return;
      }
      
      // Initialize backend
      const { UltraPlonkBackend } = backendModule;
      this.backend = new UltraPlonkBackend(this.circuitBytecode);
      
      // Initialize Noir
      const { Noir } = noirModule;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const noir = new Noir(this.circuit as any);
      await noir.init();
      
      this.initialized = true;
      console.log('[NoirProver] Initialized successfully');
    } catch (error) {
      console.error('[NoirProver] Initialization failed:', error);
      this.initialized = false;
    }
  }
  
  private async loadCircuit(): Promise<void> {
    // Load the compiled circuit from public directory
    try {
      const response = await fetch('/circuits/effort_threshold/target/effort_threshold.json');
      if (response.ok) {
        const circuitJson = await response.json();
        this.circuit = circuitJson;
        
        // The JSON contains the bytecode directly
        if (circuitJson.bytecode) {
          // Convert hex string to Uint8Array
          const hex = circuitJson.bytecode.replace(/^0x/, '');
          this.circuitBytecode = new Uint8Array(
            hex.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []
          );
        }
        
        console.log('[NoirProver] Circuit loaded successfully');
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
    if (!this.initialized || !this.backend) {
      throw new Error('Prover not initialized');
    }
    
    // Prepare witness based on circuit type
    const witness = this.prepareWitness(input, circuitType);
    
    // Generate proof
    const startTime = performance.now();
    const { proof, publicInputs } = await this.backend.generateProof(witness);
    const provingTime = performance.now() - startTime;
    
    console.log(`[NoirProver] Proof generated in ${provingTime.toFixed(0)}ms`);
    
    return {
      proof,
      publicInputs: [...this.normalizePublicInputs(publicInputs), input.classId, input.riderId],
      circuitType,
      verifierAddress: ZK_CONFIG.verifierAddress ?? "",
    };
  }
  
  async verifyProof(proof: ZKProof): Promise<boolean> {
    if (!this.backend) {
      throw new Error('Prover not initialized');
    }
    
    const startTime = performance.now();
    const valid = await this.backend.verifyProof(proof.proof, proof.publicInputs);
    const verifyTime = performance.now() - startTime;
    
    console.log(`[NoirProver] Verification completed in ${verifyTime.toFixed(0)}ms`);
    
    return valid;
  }
  
  private prepareWitness(input: ProofInput, _circuitType: CircuitType): unknown {
    // Convert telemetry to circuit format
    // Circuit expects fixed-size array of 60 points
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
    
    return {
      heart_rates: heartRates,
      num_points: numPoints,
      threshold: input.threshold,
      min_duration: input.minDuration,
    };
  }

  private normalizePublicInputs(values: string[]): string[] {
    return values.slice(0, 5).map((value) => {
      if (value === "true") return "1";
      if (value === "false") return "0";
      return value;
    });
  }
  
  // Check if Noir is available (circuits compiled and deployed)
  isAvailable(): boolean {
    return this.initialized && this.circuitBytecode !== null;
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
