"use client";

import { useState, useEffect, useCallback } from "react";

interface UseSimulatedRewardsOptions {
  isRiding: boolean;
  isTrainingMode: boolean;
  isGuestMode: boolean;
  effortScore: number;
}

/**
 * Simulated reward ticker for training/guest mode.
 * Shows users what they could be earning to incentivize wallet connection.
 * Mirrors IncentiveEngine.sol logic: base 10 SPIN + (effortScore * 90) / 1000
 */
export function useSimulatedRewards({
  isRiding,
  isTrainingMode,
  isGuestMode,
  effortScore,
}: UseSimulatedRewardsOptions) {
  const [simulatedReward, setSimulatedReward] = useState(0);
  const shouldSimulate = isRiding && (isTrainingMode || isGuestMode);

  useEffect(() => {
    if (!shouldSimulate) {
      if (!isRiding) setSimulatedReward(0);
      return;
    }

    const interval = setInterval(() => {
      const clampedEffort = Math.min(1000, effortScore);
      // Spread total potential reward over a 45-minute ride
      const ratePerSecond = (10 + (clampedEffort * 90) / 1000) / (45 * 60);
      setSimulatedReward(prev => prev + ratePerSecond);
    }, 1000);

    return () => clearInterval(interval);
  }, [shouldSimulate, isRiding, effortScore]);

  const reset = useCallback(() => setSimulatedReward(0), []);

  return {
    simulatedReward,
    isSimulating: shouldSimulate,
    formattedReward: simulatedReward.toFixed(1),
    reset,
  };
}
