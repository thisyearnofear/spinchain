// Noir Prover - Production ZK proof generation using real Noir circuits
// Witness generation via @noir-lang/noir_js; proving via @aztec/bb.js
// UltraHonk, whose browser backend runs the heavy WASM work in its own
// worker — off the main thread. Proofs use the EVM (keccak) flavor so they
// match the generated HonkVerifier.sol.

import type { ProofInput, ZKProof, CircuitType } from './types';
import { ZK_CONFIG } from "@/app/config";

// Compiled circuit shape from Nargo
interface CompiledCircuit {
  bytecode: string;
  abi: unknown;
}

// ProofData shape returned by the Barretenberg backend
interface ProofData {
  proof: Uint8Array;
  publicInputs: string[];
}

interface HonkBackend {
  generateProof(compressedWitness: Uint8Array, options?: object): Promise<ProofData>;
  verifyProof(proofData: ProofData, options?: object): Promise<boolean>;
}

interface NoirProgram {
  init(): Promise<void>;
  execute(inputs: Record<string, unknown>): Promise<{ witness: Uint8Array }>;
}

const EVM_PROOF_OPTIONS = { verifierTarget: 'evm' } as const;

/** Public outputs come back as hex field elements (e.g. "0x...01") */
function fieldToNumber(value: string | undefined): number {
  if (!value) return 0;
  if (value === 'true') return 1;
  if (value === 'false') return 0;
  try {
    return Number(BigInt(value));
  } catch {
    return parseInt(value, 10) || 0;
  }
}

/** Barretenberg expects public inputs as 32-byte hex field elements */
function numberToField(value: string): string {
  try {
    return '0x' + BigInt(value).toString(16).padStart(64, '0');
  } catch {
    return value;
  }
}

// Browser-compatible Noir prover using @noir-lang/noir_js + @aztec/bb.js
export class NoirProver {
  private backend: HonkBackend | null = null;
  private noir: NoirProgram | null = null;
  private circuit: CompiledCircuit | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Browser only — not during SSR/build
      if (typeof window === 'undefined') {
        console.warn('[NoirProver] Not in browser, skipping initialization');
        return;
      }

      // Load compiled circuit from public directory
      await this.loadCircuit();

      if (!this.circuit) {
        console.warn('[NoirProver] Circuit not loaded, falling back to mock');
        return;
      }

      // Lazy-load the proving stack so its WASM stays out of the main bundle
      const [noirMod, bbMod] = await Promise.all([
        import('@noir-lang/noir_js'),
        import('@aztec/bb.js'),
      ]);

      const api = await bbMod.Barretenberg.new();
      this.backend = new bbMod.UltraHonkBackend(
        this.circuit.bytecode,
        api,
      ) as unknown as HonkBackend;
      this.noir = new noirMod.Noir(this.circuit as never) as unknown as NoirProgram;
      await this.noir.init();

      this.initialized = true;
      console.log('[NoirProver] Initialized successfully with UltraHonkBackend');
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

    // Execute circuit to get witness (fast); proving runs in bb.js's worker
    const startTime = performance.now();
    const { witness } = await this.noir.execute(circuitInputs);

    const proofData: ProofData = await this.backend.generateProof(witness, EVM_PROOF_OPTIONS);
    const provingTime = performance.now() - startTime;

    console.log(`[NoirProver] Proof generated in ${provingTime.toFixed(0)}ms`);

    // Circuit returns: [threshold_met (bool), seconds_above (u32), effort_score (u16)]
    // Map to the 7-element format expected by ZKProof consumers:
    // [threshold, minDuration, thresholdMet, secondsAbove, effortScore, classId, riderId]
    const rawOutputs = proofData.publicInputs;
    const thresholdMet = fieldToNumber(rawOutputs[0]) ? '1' : '0';
    const secondsAbove = String(fieldToNumber(rawOutputs[1]));
    const effortScore = String(fieldToNumber(rawOutputs[2]));

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
    // Our circuit has no public inputs (all in private struct), only public
    // return values: [threshold_met, seconds_above, effort_score]. In our
    // 7-element ZKProof format, these are at indices 2-4.
    const proofData: ProofData = {
      proof: proof.proof,
      publicInputs: proof.publicInputs.slice(2, 5).map(numberToField),
    };
    const valid = await this.backend.verifyProof(proofData, EVM_PROOF_OPTIONS);
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
