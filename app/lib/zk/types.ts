// ZK Proof Types - Compatible with Noir and SP1
// Single source of truth for all ZK-related types

export type CircuitType = 'effort_threshold' | 'heart_rate_zone' | 'cadence_range' | 'composite';

export interface ProofInput {
  // Private inputs (never revealed)
  heartRate: number;
  power: number;
  cadence: number;
  timestamp: number;
  riderId: string;
  
  // Public inputs (revealed for verification)
  threshold: number;
  classId: string;
  minDuration: number;
}

export interface ProofOutput {
  // What we're proving without revealing inputs
  thresholdMet: boolean;
  zoneEntered: boolean;
  durationSatisfied: boolean;
  
  // Public outputs
  effortScore: number; // 0-1000 (scaled for integer math)
  proofHash: string;
}

export interface ZKProof {
  proof: Uint8Array;
  publicInputs: string[];
  circuitType: CircuitType;
  verifierAddress: string;
}

export interface SelectiveDisclosure {
  // What the rider wants to prove
  statement: string; // e.g., "HR > 150 for 10 minutes"
  
  // What's actually revealed
  revealed: {
    effortScore: number;
    zone: string;
    duration: number;
  };
  
  // What's hidden (private)
  hidden: {
    maxHeartRate: number;
    avgPower: number;
    rawDataPoints: number;
  };
}

// Circuit configuration
export interface CircuitConfig {
  type: CircuitType;
  constraints: number;
  provingTime: number; // milliseconds
  verificationTime: number; // milliseconds
  proofSize: number; // bytes
}

export const CIRCUIT_CONFIGS: Record<CircuitType, CircuitConfig> = {
  effort_threshold: {
    type: 'effort_threshold',
    constraints: 1024,
    provingTime: 500,
    verificationTime: 50,
    proofSize: 192,
  },
  heart_rate_zone: {
    type: 'heart_rate_zone',
    constraints: 2048,
    provingTime: 800,
    verificationTime: 75,
    proofSize: 256,
  },
  cadence_range: {
    type: 'cadence_range',
    constraints: 512,
    provingTime: 400,
    verificationTime: 40,
    proofSize: 128,
  },
  composite: {
    type: 'composite',
    constraints: 4096,
    provingTime: 1500,
    verificationTime: 100,
    proofSize: 384,
  },
};
