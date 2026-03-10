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
 * Virtual Drivetrain - Simulated gears for spin bikes
 */
export interface GearConfig {
  front: number[]; // Chainrings (e.g. [50, 34])
  rear: number[];  // Cassette (e.g. [11, 12, 13, 14, 15, 17, 19, 21, 23, 25, 28])
}

export const DEFAULT_ROAD_GEARS: GearConfig = {
  front: [50, 34],
  rear: [11, 12, 13, 14, 15, 17, 19, 21, 23, 25, 28],
};

/**
 * Maps a single "Gear Number" (1-N) to a specific front/rear combination.
 * 1 = Lowest (e.g. 34-28), N = Highest (e.g. 50-11)
 */
export function getGearRatio(gearNum: number, config: GearConfig = DEFAULT_ROAD_GEARS): { ratio: number; label: string } {
  const totalGears = config.front.length * config.rear.length;
  const index = Math.max(1, Math.min(totalGears, gearNum)) - 1;

  // Sort all possible combinations by ratio
  const combos: { f: number, r: number, ratio: number }[] = [];
  config.front.forEach(f => {
    config.rear.forEach(r => {
      combos.push({ f, r, ratio: f / r });
    });
  });
  combos.sort((a, b) => a.ratio - b.ratio);

  const selected = combos[index];
  return {
    ratio: selected.ratio,
    label: `${selected.f}/${selected.r}`,
  };
}

/**
 * Calculate "Virtual Speed" based on cadence, gear ratio, and wheel size.
 * Formula: Cadence * Ratio * WheelCircumference * 60 / 1000000 = km/h
 * 
 * @param cadence Pedal RPM
 * @param gearRatio Front/Rear ratio
 * @param wheelDiameterMm Standard 700c is ~700mm
 */
export function calculateVirtualSpeed(
  cadence: number,
  gearRatio: number,
  wheelDiameterMm: number = 700
): number {
  if (cadence <= 0) return 0;
  const circumference = wheelDiameterMm * Math.PI; // mm
  const distancePerMinute = cadence * gearRatio * circumference; // mm/min
  const speedKmh = (distancePerMinute * 60) / 1000000;
  return Number(speedKmh.toFixed(1));
}

/**
 * Physics-based Power to Speed (Advanced fallback)
 * Uses simplified drag/gravity model when no cadence is available
 */
export function powerToSpeed(
  power: number,
  weightKg: number = 80,
  gradientPct: number = 0,
  cda: number = 0.35, // Coefficient of Drag * Frontal Area
  crr: number = 0.005 // Rolling Resistance
): number {
  if (power <= 0) return 0;

  const GRAVITY = 9.81;
  const RHO = 1.225; // Air density kg/m^3

  // Simplified iterative solve for Velocity (v)
  // Power = (Gravity * Weight * (sin(atan(grad)) + Crr * cos(atan(grad))) * v) + (0.5 * Rho * CdA * v^3)
  // For most trainer apps, we use a pre-calculated lookup or simple cubic solver
  // Here we use a linear approximation for hackathon performance:
  const gradDec = gradientPct / 100;
  const gravityForce = weightKg * GRAVITY * (gradDec + crr);

  // Start with a guess
  let v = 5; // 5 m/s (~18 km/h)
  for (let i = 0; i < 5; i++) {
    const p_guess = (gravityForce * v) + (0.5 * RHO * cda * Math.pow(v, 3));
    v = v * Math.pow(power / p_guess, 0.33); // Cubic scaling factor
  }

  return Number((v * 3.6).toFixed(1)); // Convert m/s to km/h
}

/**
 * Get W'bal as a percentage (0-100)
 */
export function getWBalPercentage(current: number, max: number): number {
  return (current / max) * 100;
}
