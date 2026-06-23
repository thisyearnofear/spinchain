/**
 * Telemetry Normalization for Cross-Gym Support
 *
 * Applies calibration offsets from gym/bike profiles to raw telemetry
 * so that power and HR values are comparable across different bike brands.
 */

export interface CalibrationProfile {
  power_offset: number;
  power_scale: number;
  hr_offset: number;
  hr_scale: number;
}

export const DEFAULT_CALIBRATION: CalibrationProfile = {
  power_offset: 0,
  power_scale: 1.0,
  hr_offset: 0,
  hr_scale: 1.0,
};

/**
 * Normalize a raw power reading using calibration offsets.
 * Formula: normalized = raw * scale + offset
 */
export function normalizePower(rawWatts: number, cal: CalibrationProfile): number {
  return Math.round(rawWatts * cal.power_scale + cal.power_offset);
}

/**
 * Normalize a raw heart rate reading using calibration offsets.
 */
export function normalizeHeartRate(rawBpm: number, cal: CalibrationProfile): number {
  return Math.round(rawBpm * cal.hr_scale + cal.hr_offset);
}

/**
 * Merge gym-level and bike-level calibration.
 * Bike-level overrides gym-level if set (non-default).
 */
export function mergeCalibration(
  gym: CalibrationProfile,
  bike: CalibrationProfile | null,
): CalibrationProfile {
  if (!bike) return gym;
  return {
    power_offset: bike.power_offset !== 0 ? bike.power_offset : gym.power_offset,
    power_scale: bike.power_scale !== 1.0 ? bike.power_scale : gym.power_scale,
    hr_offset: bike.hr_offset !== 0 ? bike.hr_offset : gym.hr_offset,
    hr_scale: bike.hr_scale !== 1.0 ? bike.hr_scale : gym.hr_scale,
  };
}

/**
 * Normalize a batch of telemetry samples.
 */
export function normalizeTelemetryBatch(
  samples: { power?: number; heartRate?: number }[],
  cal: CalibrationProfile,
): { power?: number; heartRate?: number }[] {
  return samples.map((s) => ({
    power: s.power != null ? normalizePower(s.power, cal) : undefined,
    heartRate: s.heartRate != null ? normalizeHeartRate(s.heartRate, cal) : undefined,
  }));
}
