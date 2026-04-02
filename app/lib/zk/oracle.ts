// Local Oracle - On-device proof generation
// Privacy-first: All computation happens locally, no data leaves device

import type { ZKProof } from './types';
import { getProver, ZKProver } from './prover';
import { getAssetManager } from '../walrus/client';
import { DisclosureBuilder, DEFAULT_POLICY } from './disclosure';

// Telemetry data point from sensors
export interface TelemetryPoint {
  timestamp: number;
  heartRate: number;
  power: number;
  cadence: number;
  gps?: { lat: number; lng: number; elevation: number };
}

// Session configuration
export interface SessionConfig {
  classId: string;
  riderId: string;
  startTime: number;
  targetHeartRate: number;
  minDuration: number; // seconds
}

// Proof generation result
export interface LocalProofResult {
  success: boolean;
  proof?: ZKProof;
  proofs?: ZKProof[];
  disclosure?: {
    statement: string;
    revealed: {
      effortScore: number;
      zone: string;
      duration: number;
    };
  };
  metadata?: {
    dataPoints: number;
    maxHeartRate: number;
    avgPower: number;
    provingTime: number;
    totalSecondsAbove?: number;
    proofsGenerated?: number;
    aggregateEffortScore?: number;
  };
  error?: string;
}

// Local Oracle - runs entirely in browser
export class LocalOracle {
  private prover: ZKProver;
  private telemetryBuffer: TelemetryPoint[] = [];
  private config?: SessionConfig;
  private isRecording: boolean = false;
  
  constructor() {
    this.prover = getProver(); // Auto-selects Noir if available
  }
  
  // Start a new session
  startSession(config: SessionConfig): void {
    this.config = config;
    this.telemetryBuffer = [];
    this.isRecording = true;
    
    console.log('[LocalOracle] Session started:', config.classId);
  }
  
  // Add telemetry point (called from sensors/WebSocket)
  addTelemetry(point: TelemetryPoint): void {
    if (!this.isRecording) {
      console.warn('[LocalOracle] Not recording, ignoring telemetry');
      return;
    }
    
    this.telemetryBuffer.push(point);
    
    // Keep buffer size manageable (last 10 minutes at 1Hz)
    if (this.telemetryBuffer.length > 600) {
      this.telemetryBuffer.shift();
    }
  }
  
  // Stop recording and generate proof
  async endSession(): Promise<LocalProofResult> {
    if (!this.isRecording || !this.config) {
      return { success: false, error: 'No active session' };
    }
    
    this.isRecording = false;
    
    const startTime = performance.now();
    
    try {
      const result = await this.generateProofsFromHeartRateSamples({
        heartRateSamples: this.telemetryBuffer.map((point) => point.heartRate),
        avgPower: this.analyzeTelemetry().avgPower,
        classId: this.config.classId,
        riderId: this.config.riderId,
        threshold: this.config.targetHeartRate,
        minDuration: this.config.minDuration,
      });
      if (!result.success) {
        return result;
      }
      
      // Store raw telemetry to Walrus (optional, encrypted)
      await this.storeTelemetrySecurely();

      return {
        ...result,
        metadata: result.metadata
          ? {
              ...result.metadata,
              provingTime: performance.now() - startTime,
            }
          : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Proof generation failed',
      };
    }
  }
  
  // Real-time proof update (for long sessions)
  async generateIntermediateProof(): Promise<LocalProofResult> {
    if (!this.config) {
      return { success: false, error: 'No active session' };
    }
    
    const samples = this.telemetryBuffer.slice(-60).map((point) => point.heartRate);
    if (samples.length < 10) {
      return {
        success: false,
        error: 'Insufficient data (need 10+ seconds)',
      };
    }

    const proof = await this.prover.proveEffortThreshold(
      Math.max(...samples),
      this.config.targetHeartRate,
      this.config.classId,
      this.config.riderId,
      1,
      samples,
    );
    
    const disclosure = new DisclosureBuilder(DEFAULT_POLICY)
      .withProof(proof)
      .withStatement(`Effort in progress: ${Math.round(samples.length / 60)} minutes`)
      .build();
    
    return {
      success: true,
      proof,
      proofs: [proof],
      disclosure: {
        statement: disclosure.statement,
        revealed: disclosure.revealed,
      },
    };
  }

  async generateProofsFromHeartRateSamples(input: {
    heartRateSamples: number[];
    avgPower?: number;
    classId: string;
    riderId: string;
    threshold: number;
    minDuration: number;
  }): Promise<LocalProofResult> {
    if (input.heartRateSamples.length === 0) {
      return { success: false, error: "No telemetry samples available" };
    }

    const chunks = this.chunkHeartRateSamples(input.heartRateSamples);
    const proofs: ZKProof[] = [];
    let totalSecondsAbove = 0;
    let weightedEffortScore = 0;

    for (const chunk of chunks) {
      const secondsAbove = chunk.filter((sample) => sample > input.threshold).length;
      if (secondsAbove === 0) continue;

      const proof = await this.prover.proveEffortThreshold(
        Math.max(...chunk),
        input.threshold,
        input.classId,
        input.riderId,
        1,
        chunk,
      );

      const effortScore = parseInt(proof.publicInputs[4] || "0", 10) || 0;
      totalSecondsAbove += secondsAbove;
      weightedEffortScore += effortScore * secondsAbove;
      proofs.push(proof);
    }

    if (proofs.length === 0 || totalSecondsAbove < input.minDuration) {
      return {
        success: false,
        error: `Threshold not met for required duration (${input.minDuration}s)`,
      };
    }

    const aggregateEffortScore = Math.round(weightedEffortScore / totalSecondsAbove);
    const proof = proofs[0];
    const disclosure = new DisclosureBuilder(DEFAULT_POLICY)
      .withProof(proof)
      .withStatement(
        `Maintained effort above threshold for ${Math.round(totalSecondsAbove / 60)} minutes`,
      )
      .withMetadata({ duration: totalSecondsAbove })
      .build();

    return {
      success: true,
      proof,
      proofs,
      disclosure: {
        statement: disclosure.statement,
        revealed: {
          ...disclosure.revealed,
          effortScore: aggregateEffortScore,
          duration: totalSecondsAbove,
        },
      },
      metadata: {
        dataPoints: input.heartRateSamples.length,
        maxHeartRate: Math.max(...input.heartRateSamples),
        avgPower: input.avgPower ?? 0,
        provingTime: 0,
        totalSecondsAbove,
        proofsGenerated: proofs.length,
        aggregateEffortScore,
      },
    };
  }

  private chunkHeartRateSamples(samples: number[]): number[][] {
    const chunkSize = 60;
    const chunks: number[][] = [];

    for (let index = 0; index < samples.length; index += chunkSize) {
      chunks.push(samples.slice(index, index + chunkSize));
    }

    return chunks;
  }
  
  // Analyze buffered telemetry
  private analyzeTelemetry(): {
    maxHeartRate: number;
    avgPower: number;
    avgCadence: number;
    durationMinutes: number;
    thresholdTime: number; // seconds above threshold
  } {
    if (this.telemetryBuffer.length === 0) {
      return {
        maxHeartRate: 0,
        avgPower: 0,
        avgCadence: 0,
        durationMinutes: 0,
        thresholdTime: 0,
      };
    }
    
    const hrs = this.telemetryBuffer.map(t => t.heartRate);
    const powers = this.telemetryBuffer.map(t => t.power);
    const cadences = this.telemetryBuffer.map(t => t.cadence);
    
    const maxHeartRate = Math.max(...hrs);
    const avgPower = powers.reduce((a, b) => a + b, 0) / powers.length;
    const avgCadence = cadences.reduce((a, b) => a + b, 0) / cadences.length;
    
    const first = this.telemetryBuffer[0].timestamp;
    const last = this.telemetryBuffer[this.telemetryBuffer.length - 1].timestamp;
    const durationMinutes = Math.floor((last - first) / 60000);
    
    // Time above threshold
    const thresholdTime = this.telemetryBuffer
      .filter(t => t.heartRate > (this.config?.targetHeartRate || 0))
      .length; // Assuming 1Hz = 1 second per point
    
    return {
      maxHeartRate,
      avgPower,
      avgCadence,
      durationMinutes,
      thresholdTime,
    };
  }
  
  // Store telemetry encrypted to Walrus
  private async storeTelemetrySecurely(): Promise<void> {
    if (!this.config || this.telemetryBuffer.length === 0) return;
    
    try {
      const manager = getAssetManager();
      
      // Extract just the numeric data (no GPS for privacy)
      const telemetry = {
        heartRate: this.telemetryBuffer.map(t => t.heartRate),
        power: this.telemetryBuffer.map(t => t.power),
        cadence: this.telemetryBuffer.map(t => t.cadence),
        timestamps: this.telemetryBuffer.map(t => t.timestamp),
      };
      
      await manager.storeTelemetry(telemetry, {
        sessionId: `${this.config.classId}-${this.config.riderId}-${Date.now()}`,
        riderId: this.config.riderId,
        classId: this.config.classId,
      });
      
      console.log('[LocalOracle] Telemetry stored securely');
    } catch (error) {
      console.error('[LocalOracle] Failed to store telemetry:', error);
      // Non-blocking - proof still works without storage
    }
  }
  
  // Get current session stats (for UI)
  getSessionStats(): {
    isRecording: boolean;
    dataPoints: number;
    currentHeartRate: number;
    currentPower: number;
    durationSeconds: number;
  } {
    const last = this.telemetryBuffer[this.telemetryBuffer.length - 1];
    const first = this.telemetryBuffer[0];
    
    return {
      isRecording: this.isRecording,
      dataPoints: this.telemetryBuffer.length,
      currentHeartRate: last?.heartRate || 0,
      currentPower: last?.power || 0,
      durationSeconds: last && first ? Math.floor((last.timestamp - first.timestamp) / 1000) : 0,
    };
  }
}

// Singleton instance
let oracleInstance: LocalOracle | null = null;

export function getLocalOracle(): LocalOracle {
  if (!oracleInstance) {
    oracleInstance = new LocalOracle();
  }
  return oracleInstance;
}

// React hook for components
export function useLocalOracle() {
  const oracle = getLocalOracle();
  
  return {
    oracle,
    startSession: (config: SessionConfig) => oracle.startSession(config),
    addTelemetry: (point: TelemetryPoint) => oracle.addTelemetry(point),
    endSession: () => oracle.endSession(),
    getStats: () => oracle.getSessionStats(),
  };
}
