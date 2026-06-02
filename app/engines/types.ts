/**
 * Engine Types — Shared types used across all engines.
 *
 * Design rules:
 * - Reuse existing types from the codebase where they exist
 * - Define new types only when no existing type fits
 * - Keep the surface area minimal to reduce coupling
 *
 * NOTE: import type for local use, then export type for re-export.
 * In TypeScript, `export type { X } from "..."` re-exports but does NOT
 * make X available in the current scope for local interface definitions.
 */

// Import locally for use in this file's interfaces
import type { GhostState, GhostPerformance } from "@/app/lib/analytics/ghost-service";
import type { RideRecordPoint } from "@/app/lib/analytics/ride-recorder";
import type { WorkoutPlan, WorkoutInterval, IntervalPhase } from "@/app/lib/workout-plan";

// Re-export for consumers
export type { GhostState, GhostPerformance, RideRecordPoint, WorkoutPlan, WorkoutInterval, IntervalPhase };
export type { WBalConfig } from "@/app/lib/analytics/physiological-models";

// ─── Device ─────────────────────────────────────────────────────

export type DeviceType = "mobile" | "tablet" | "desktop";

export type PerformanceTier = "high" | "medium" | "low";

export interface DeviceStatus {
  type: "ble" | "simulator" | "keyboard" | "none";
  connected: boolean;
  hint: string | null;
}

// ─── Telemetry ──────────────────────────────────────────────────

export interface TelemetrySnapshot {
  heartRate: number;
  power: number;
  cadence: number;
  speed: number;
  effort: number;
  wBal: number;
  wBalPercentage: number;
  currentGear: number;
  gearRatio: number;
  distance: number;
  resistance: number;
  timestamp: number;
}

export interface TelemetryAverages {
  avgHr: number;
  avgPower: number;
  avgEffort: number;
}

export interface TelemetryHistory {
  power: number[];
  cadence: number[];
  heartRate: number[];
}

// ─── Ride Lifecycle ─────────────────────────────────────────────

export interface RideSessionInfo {
  classId: string;
  durationSeconds: number;
  isPractice: boolean;
}

export interface RideSummary {
  classId: string;
  duration: number;
  avgHeartRate: number;
  maxHeartRate: number;
  avgPower: number;
  avgEffort: number;
  totalDistance: number;
  ridePoints: RideRecordPoint[];
  telemetrySource: "live-bike" | "simulator" | "estimated";
  effortScore: number;
  completedAt: number;
}

// ─── AI Coaching ────────────────────────────────────────────────

export interface AILogEntry {
  type: "observation" | "action" | "encouragement" | "correction";
  message: string;
  timestamp: number;
  confidence?: number;
}

export interface ReasonerState {
  thoughtProcess: string;
  action?: string;
  confidence?: number;
  emotion?: string;
  timestamp: number;
}

// ─── Social ─────────────────────────────────────────────────────

export interface SocialEvent {
  id: string;
  type: "high_five" | "recommendation" | "nudge";
  message: string;
  timestamp: number;
  from?: string;
}

export interface MultiGhostState {
  id: string;
  name: string;
  leadLagTime: number;
  distanceGap: number;
  active: boolean;
  power: number;
}

// ─── Rewards ────────────────────────────────────────────────────

export type RewardMode = "zk-batch" | "yellow-stream" | "sui-native";

export interface RewardEngineState {
  mode: RewardMode;
  active: boolean;
  accumulatedReward: bigint;
  streamStatus: "idle" | "streaming" | "finalized";
  zkBatchSize: number;
  simulatedSpin: number;
}

export interface SuiSessionStatus {
  active: boolean;
  sessionId: string | null;
  pendingBatches: number;
  submittedBatches: number;
  error: string | null;
}

// ─── Configuration ──────────────────────────────────────────────

export interface CoachingConfig {
  agentName: string;
  personality: "zen" | "drill-sergeant" | "data";
  workoutPlan: WorkoutPlan | null;
  instructorProfile: Record<string, unknown> | null;
  marketStats: { ticketsSold: number; revenue: number; capacity: number };
  aiActive: boolean;
  setResistance?: (level: number) => Promise<void>;
}

export interface RideStartConfig {
  classId: string;
  classData: {
    metadata?: { duration?: number; name?: string; instructor?: string } | null;
    route?: {
      route?: {
        coordinates?: Array<{ lat: number; lng: number; ele?: number }>;
        elevationProfile?: number[];
        storyBeats?: Array<{ progress: number; label: string; type: string }>;
      };
    } | null;
  } | null;
  deviceType: DeviceType;
  performanceTier: PerformanceTier;
  isPracticeMode: boolean;
  walletConnected: boolean;
  address?: string;
  rewardMode: RewardMode;
  coachingConfig: CoachingConfig;
  ghostBlobId?: string;
}
