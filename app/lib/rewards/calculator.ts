/**
 * Reward Calculator
 * 
 * Core Principles:
 * - DRY: Single source of truth for reward calculations
 * - CLEAN: Pure functions, no side effects
 * - MODULAR: Reusable across all reward modes (Yellow, ZK, Sui)
 * 
 * This module consolidates reward calculation logic that was previously
 * duplicated between IncentiveEngine.sol and useZKClaim hook.
 */

import type {
  RewardCalculation,
  EffortInput,
  SignedRewardUpdate,
} from "./types";

// ============================================================================
// Constants (mirrors IncentiveEngine.sol)
// ============================================================================

/** Base reward: 10 SPIN (with 18 decimals) */
export const BASE_REWARD = BigInt(10) * BigInt(10) ** BigInt(18);

/** Maximum bonus: 90 SPIN (for effort score 1000) */
export const MAX_BONUS = BigInt(90) * BigInt(10) ** BigInt(18);

/** SPIN token decimals */
export const SPIN_DECIMALS = 18;

/** Heart rate zones for effort calculation */
export const HR_ZONES = {
  recovery: { min: 0, max: 0.6 }, // < 60% max HR
  endurance: { min: 0.6, max: 0.7 }, // 60-70%
  tempo: { min: 0.7, max: 0.8 }, // 70-80%
  threshold: { min: 0.8, max: 0.9 }, // 80-90%
  vo2max: { min: 0.9, max: 1.0 }, // 90-100%
};

// ============================================================================
// Effort Score Calculation
// ============================================================================

/**
 * Calculate effort score (0-1000) based on heart rate and power
 * 
 * @param input - Effort input data
 * @returns Effort score 0-1000
 */
export function calculateEffortScore(input: EffortInput): number {
  const { heartRate, power, maxHeartRate = 200, ftp = 200 } = input;

  // Heart rate zone score (0-500)
  const hrPercent = heartRate / maxHeartRate;
  const hrScore = Math.min(Math.floor(hrPercent * 500), 500);

  // Power zone score (0-500)
  const powerPercent = power / ftp;
  const powerScore = Math.min(Math.floor(powerPercent * 500), 500);

  // Combined score with HR weighted slightly more
  return Math.min(hrScore * 0.6 + powerScore * 0.4, 1000);
}

/**
 * Get heart rate zone name for display
 */
export function getHeartRateZone(heartRate: number, maxHeartRate: number = 200): string {
  const percent = heartRate / maxHeartRate;
  
  if (percent < HR_ZONES.recovery.max) return "Recovery";
  if (percent < HR_ZONES.endurance.max) return "Endurance";
  if (percent < HR_ZONES.tempo.max) return "Tempo";
  if (percent < HR_ZONES.threshold.max) return "Threshold";
  return "VO2 Max";
}

// ============================================================================
// Reward Calculation
// ============================================================================

/**
 * Calculate reward based on effort
 * 
 * Mirrors IncentiveEngine.sol calculateReward() function:
 * - Base reward: 10 SPIN
 * - Bonus: up to 90 SPIN based on effort score
 * 
 * @param effortScore - Effort score 0-1000
 * @returns Reward calculation result
 */
export function calculateRewardFromScore(effortScore: number): RewardCalculation {
  // Clamp effort score to valid range
  const clampedScore = Math.max(0, Math.min(1000, effortScore));
  
  // Calculate bonus: (effortScore * 90) / 1000
  const bonus = (BigInt(clampedScore) * MAX_BONUS) / BigInt(1000);
  
  return {
    baseAmount: BASE_REWARD,
    effortBonus: bonus,
    totalAmount: BASE_REWARD + bonus,
    effortScore: clampedScore,
  };
}

/**
 * Calculate reward from telemetry data
 * 
 * @param input - Effort input data
 * @returns Reward calculation result
 */
export function calculateReward(input: EffortInput): RewardCalculation {
  const effortScore = calculateEffortScore(input);
  return calculateRewardFromScore(effortScore);
}

/**
 * Calculate accumulated reward over time
 * 
 * For Yellow streaming: calculates incremental reward since last update
 * 
 * @param currentTelemetry - Current telemetry reading
 * @param previousTelemetry - Previous telemetry reading (for time delta)
 * @param previousAccumulated - Previously accumulated reward
 * @returns New total accumulated reward
 */
export function calculateAccumulatedReward(
  currentTelemetry: { heartRate: number; power: number },
  previousTelemetry: { heartRate: number; power: number; timestamp: number },
  previousAccumulated: bigint
): bigint {
  const now = Date.now();
  const timeDeltaSeconds = (now - previousTelemetry.timestamp) / 1000;
  
  // Calculate reward for this time period
  const effortScore = calculateEffortScore({
    heartRate: currentTelemetry.heartRate,
    power: currentTelemetry.power,
    durationSeconds: timeDeltaSeconds,
  });
  
  const reward = calculateRewardFromScore(effortScore);
  
  // Scale reward by time (reward per minute)
  const timeScaledReward = (reward.totalAmount * BigInt(Math.floor(timeDeltaSeconds))) / BigInt(60);
  
  return previousAccumulated + timeScaledReward;
}

// ============================================================================
// Streaming Reward Helpers
// ============================================================================

/**
 * Calculate reward for a single signed update
 * 
 * @param update - Signed reward update
 * @param previousUpdate - Previous update (for time delta calculation)
 * @returns Reward amount for this update period
 */
export function calculateUpdateReward(
  update: SignedRewardUpdate,
  previousUpdate?: SignedRewardUpdate
): bigint {
  if (!previousUpdate) {
    // First update: calculate from scratch
    const effortScore = calculateEffortScore({
      heartRate: update.heartRate,
      power: update.power,
      durationSeconds: 10, // Assume 10s intervals
    });
    const reward = calculateRewardFromScore(effortScore);
    return reward.totalAmount / BigInt(6); // 10 seconds = 1/6 of a minute
  }
  
  // Incremental: difference in accumulated amounts
  return update.accumulatedReward - previousUpdate.accumulatedReward;
}

/**
 * Format reward amount for display
 * 
 * @param amount - Raw amount (wei/SPIN units)
 * @param decimals - Token decimals (default 18)
 * @param precision - Decimal places to show (default 2)
 * @returns Formatted string
 */
export function formatReward(
  amount: bigint,
  decimals: number = SPIN_DECIMALS,
  precision: number = 2
): string {
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  
  // Pad fraction with leading zeros
  const fractionStr = fraction.toString().padStart(decimals, "0");
  const truncatedFraction = fractionStr.slice(0, precision);
  
  return `${whole}.${truncatedFraction}`;
}

/**
 * Parse reward string to bigint
 * 
 * @param value - String value (e.g., "10.5")
 * @param decimals - Token decimals (default 18)
 * @returns BigInt amount
 */
export function parseReward(value: string, decimals: number = SPIN_DECIMALS): bigint {
  const [whole, fraction = ""] = value.split(".");
  const wholeBig = BigInt(whole) * BigInt(10) ** BigInt(decimals);
  const fractionBig = BigInt((fraction || "").padEnd(decimals, "0").slice(0, decimals));
  return wholeBig + fractionBig;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate that accumulated reward is reasonable
 * Prevents overflow or manipulation
 */
export function isValidAccumulatedReward(
  accumulated: bigint,
  durationSeconds: number,
  maxRewardPerMinute: bigint = BigInt(100) * BigInt(10) ** BigInt(18) // 100 SPIN/min max
): boolean {
  const maxExpected = (maxRewardPerMinute * BigInt(durationSeconds)) / BigInt(60);
  return accumulated >= BigInt(0) && accumulated <= maxExpected;
}
