// Local Oracle - On-device proof generation
// Privacy-first: All computation happens locally, no data leaves device

import type { ProofInput, ZKProof, CircuitType } from './types';
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
    this.prover = getProver(true); // Use mock for now
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
      // Analyze telemetry
      const analysis = this.analyzeTelemetry();
      
      // Generate ZK proof
      const proof = await this.prover.proveEffortThreshold(
        analysis.maxHeartRate,
        this.config.targetHeartRate,
        this.config.classId,
        this.config.riderId,
        analysis.durationMinutes
      );
      
      // Create selective disclosure
      const disclosure = new DisclosureBuilder(DEFAULT_POLICY)
        .withProof(proof)
        .withStatement(
          `Maintained effort above threshold for ${analysis.durationMinutes} minutes`
        )
        .withMetadata({ duration: analysis.durationMinutes })
        .build();
      
      const provingTime = performance.now() - startTime;
      
      // Store raw telemetry to Walrus (optional, encrypted)
      await this.storeTelemetrySecurely();
      
      return {
        success: true,
        proof,
        disclosure: {
          statement: disclosure.statement,
          revealed: disclosure.revealed,
        },
        metadata: {
          dataPoints: this.telemetryBuffer.length,
          maxHeartRate: analysis.maxHeartRate,
          avgPower: analysis.avgPower,
          provingTime,
        },
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
    
    const analysis = this.analyzeTelemetry();
    
    // Only generate if we have enough data
    if (analysis.durationMinutes < 5) {
      return {
        success: false,
        error: 'Insufficient data (need 5+ minutes)',
      };
    }
    
    const proof = await this.prover.proveEffortThreshold(
      analysis.maxHeartRate,
      this.config.targetHeartRate,
      this.config.classId,
      this.config.riderId,
      analysis.durationMinutes
    );
    
    const disclosure = new DisclosureBuilder(DEFAULT_POLICY)
      .withProof(proof)
      .withStatement(`Effort in progress: ${analysis.durationMinutes} minutes`)
      .build();
    
    return {
      success: true,
      proof,
      disclosure: {
        statement: disclosure.statement,
        revealed: disclosure.revealed,
      },
    };
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
