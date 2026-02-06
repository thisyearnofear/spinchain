/**
 * Consolidated Rewards Types
 * 
 * Core Principles:
 * - DRY: Single source of truth for all reward-related types
 * - CLEAN: Clear separation between calculation, channel, and settlement types
 * - MODULAR: Types support multiple reward modes (Yellow, ZK, Sui)
 */

import type { TelemetryPoint } from "../zk/oracle";

// ============================================================================
// Reward Calculation
// ============================================================================

export interface RewardCalculation {
  /** Base reward amount (wei/SPIN units) */
  baseAmount: bigint;
  /** Bonus based on effort score */
  effortBonus: bigint;
  /** Total reward = base + bonus */
  totalAmount: bigint;
  /** Effort score 0-1000 */
  effortScore: number;
}

export interface EffortInput {
  heartRate: number;
  power: number;
  durationSeconds: number;
  /** Optional: rider's max HR for zone calculation */
  maxHeartRate?: number;
  /** Optional: rider's FTP for power zone */
  ftp?: number;
}

// ============================================================================
// Reward Modes
// ============================================================================

export type RewardMode = "yellow-stream" | "zk-batch" | "sui-native";

export interface RewardModeConfig {
  mode: RewardMode;
  /** Human-readable label */
  label: string;
  /** Description for UI */
  description: string;
  /** Whether this mode supports real-time streaming */
  supportsStreaming: boolean;
  /** Whether this mode requires ZK proofs */
  requiresZK: boolean;
  /** Chain ID for settlement */
  settlementChain: number;
}

export const REWARD_MODES: Record<RewardMode, RewardModeConfig> = {
  "yellow-stream": {
    mode: "yellow-stream",
    label: "Yellow Stream",
    description: "Real-time micro-rewards via state channels",
    supportsStreaming: true,
    requiresZK: false,
    settlementChain: 43113, // Avalanche Fuji
  },
  "zk-batch": {
    mode: "zk-batch",
    label: "ZK Batch",
    description: "Privacy-preserving batch rewards with ZK proofs",
    supportsStreaming: false,
    requiresZK: true,
    settlementChain: 43113,
  },
  "sui-native": {
    mode: "sui-native",
    label: "Sui Native",
    description: "Native Sui SPIN token rewards",
    supportsStreaming: false,
    requiresZK: false,
    settlementChain: 0, // Sui doesn't use EVM chain IDs
  },
};

// ============================================================================
// Yellow State Channel Types
// ============================================================================

export interface RewardChannel {
  /** Unique channel ID */
  id: string;
  /** Rider address */
  rider: `0x${string}`;
  /** Instructor address */
  instructor: `0x${string}`;
  /** Class ID */
  classId: `0x${string}`;
  /** Channel opened timestamp */
  openedAt: number;
  /** Channel closed timestamp */
  closedAt?: number;
  /** Initial deposit amount */
  depositAmount: bigint;
  /** Final settled amount */
  finalAmount?: bigint;
  /** Channel status */
  status: "opening" | "open" | "closing" | "closed" | "error";
}

export interface SignedRewardUpdate {
  /** Update timestamp */
  timestamp: number;
  /** Telemetry at time of update */
  telemetry: TelemetryPoint;
  /** Accumulated reward so far (wei/SPIN units) */
  accumulatedReward: bigint;
  /** Rider's signature */
  riderSignature: string;
  /** Instructor's signature (optional for demo) */
  instructorSignature?: string;
  /** Update sequence number for ordering */
  sequence: number;
}

export interface ChannelAllocation {
  participant: `0x${string}`;
  asset: "usdc" | "spin" | "eth";
  amount: string;
}

// ============================================================================
// ZK Proof Types (Consolidated from useZKClaim)
// ============================================================================

export interface ZKProofInput {
  heartRate: number;
  threshold: number;
  duration: number;
  classId: string;
  riderId: string;
}

export interface ZKProofResult {
  success: boolean;
  proof?: {
    proof: Uint8Array;
    publicInputs: string[];
  };
  effortScore?: number;
  error?: string;
}

export interface PrivacyDisclosure {
  statement: string;
  revealed: {
    effortScore: number;
    zone: string;
    duration: number;
  };
  hidden: {
    maxHeartRate: number;
    avgPower: number;
    rawDataPoints: number;
  };
}

// ============================================================================
// Settlement Types
// ============================================================================

export interface SettlementParams {
  channelId?: string;
  rider: `0x${string}`;
  instructor: `0x${string}`;
  classId: `0x${string}`;
  finalReward: bigint;
  /** Signed state updates (for Yellow) */
  signedUpdates?: SignedRewardUpdate[];
  /** ZK proof (for ZK mode) */
  zkProof?: ZKProofResult;
}

export interface SettlementResult {
  success: boolean;
  transactionHash?: `0x${string}`;
  amount: bigint;
  error?: string;
}

// ============================================================================
// UI/State Types
// ============================================================================

export interface RewardStreamState {
  /** Current accumulated reward */
  accumulated: bigint;
  /** Last update timestamp */
  lastUpdate: number;
  /** Number of updates received */
  updateCount: number;
  /** Channel status */
  status: RewardChannel["status"];
  /** Error message if any */
  error?: string;
}

export interface RewardTickerProps {
  state: RewardStreamState;
  mode: RewardMode;
  /** Token symbol (SPIN, USDC, etc) */
  symbol: string;
  /** Token decimals */
  decimals: number;
}
