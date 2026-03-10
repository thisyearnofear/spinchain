/**
 * Physiological Models - Bio-mathematical performance tracking
 * 
 * CORE MODEL: Skiba W'bal (Differential Form)
 * Tracks depletion and recovery of anaerobic capacity in real-time.
 */

export interface WBalConfig {
  criticalPower: number; // Watts (CP)
  wPrime: number;       // Joules (Anaerobic work capacity)
}

export const DEFAULT_WBAL_CONFIG: WBalConfig = {
  criticalPower: 250,   // Avg male enthusiast
  wPrime: 20000,        // 20kJ is a standard capacity
};

/**
 * Calculate the next W' balance state based on power and elapsed time.
 * Using the Skiba (2015) Differential Model for real-time efficiency.
 * 
 * @param currentWBal Current W' balance in Joules
 * @param power Current power output in Watts
 * @param deltaSeconds Seconds elapsed since last update (usually 1.0)
 * @param config Athlete CP and W' parameters
 */
export function calculateNextWBal(
  currentWBal: number,
  power: number,
  deltaSeconds: number,
  config: WBalConfig = DEFAULT_WBAL_CONFIG
): number {
  const { criticalPower, wPrime } = config;
  
  if (power > criticalPower) {
    // 1. Depletion: Linear reduction based on power above CP
    const depletion = (power - criticalPower) * deltaSeconds;
    return Math.max(0, currentWBal - depletion);
  } else {
    // 2. Recovery: Skiba (2015) proportional recovery
    // Rate is proportional to the "empty space" in the tank and how far below CP we are
    const recoveryPower = Math.max(0, criticalPower - power);
    const recoveryRate = (wPrime - currentWBal) * (recoveryPower / wPrime);
    const recovery = recoveryRate * deltaSeconds;
    return Math.min(wPrime, currentWBal + recovery);
  }
}

/**
 * Estimate W' based on rider weight and level (Simplified proxy)
 */
export function estimateWPrime(weightKg: number, level: 'beginner' | 'intermediate' | 'elite'): number {
  const multiplier = {
    beginner: 150,
    intermediate: 250,
    elite: 400,
  };
  return weightKg * multiplier[level];
}

/**
 * Get W'bal as a percentage (0-100)
 */
export function getWBalPercentage(current: number, max: number): number {
  return (current / max) * 100;
}
