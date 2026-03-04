export type SportType = 'SPIN' | 'YOGA' | 'ROWING' | 'RUNNING';

export interface SportTelemetry {
  heartRate: number;
  cadence?: number; // RPM for spin/rowing, steps for running
  power?: number;   // Watts for spin/rowing
  flexibility?: number; // 0-100 for yoga (simulated)
  caloriesBurned: number;
}

export interface SportEffortCriteria {
  sport: SportType;
  thresholds: {
    minHeartRate: number;
    targetDuration: number;
    minPower?: number;
    poseAccuracy?: number; // for yoga
  };
}

export class MultiSportAdapter {
  /**
   * Normalizes telemetry from different sports into a standard "Effort Score".
   * This score is used by the ZK circuit for reward calculation.
   */
  static normalizeEffort(telemetry: SportTelemetry[], criteria: SportEffortCriteria): number {
    let score = 0;
    const duration = telemetry.length; // assuming 1Hz for simplicity

    if (duration < criteria.thresholds.targetDuration * 60) {
      return 0; // Did not meet duration
    }

    let totalEffort = 0;
    for (const point of telemetry) {
      // Base: Heart rate contribution
      totalEffort += point.heartRate / criteria.thresholds.minHeartRate;

      // Sport specific boosts
      if (criteria.sport === 'YOGA' && point.flexibility) {
        totalEffort += point.flexibility / 100;
      } else if ((criteria.sport === 'SPIN' || criteria.sport === 'ROWING') && point.power && criteria.thresholds.minPower) {
        totalEffort += point.power / criteria.thresholds.minPower;
      }
    }

    score = Math.floor((totalEffort / duration) * 500); // Scale to 1000 max roughly
    return Math.min(1000, score);
  }

  /**
   * Generates a sport-specific "Statement" for selective disclosure.
   */
  static getPrivacyStatement(sport: SportType, score: number): string {
    switch (sport) {
      case 'SPIN':
        return `Maintained high-intensity output for cycling. Effort Score: ${score}`;
      case 'YOGA':
        return `Completed mindful flow with sustained heart rate. Flow Score: ${score}`;
      case 'ROWING':
        return `Achieved consistent power output on the rower. Power Score: ${score}`;
      case 'RUNNING':
        return `Sustained target aerobic zone during run. Endurance Score: ${score}`;
      default:
        return `Completed fitness session. Effort Score: ${score}`;
    }
  }
}
