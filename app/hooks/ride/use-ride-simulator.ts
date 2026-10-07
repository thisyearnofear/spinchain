"use client";

import { useEffect, useState } from "react";
import { useRewardsStore } from "@/app/stores/rewards-store";
import { useTelemetryStore } from "@/app/stores/telemetry-store";

interface UseRideSimulatorParams {
  isRiding: boolean;
  /** Owned by the caller so it can be shared with the lifecycle hook. */
  isRidingRef: React.MutableRefObject<boolean>;
  isTrainingMode: boolean;
  isGuestMode: boolean;
  isPracticeMode: boolean;
}

export function useRideSimulator({
  isRiding,
  isRidingRef,
  isTrainingMode,
  isGuestMode,
}: UseRideSimulatorParams) {
  useEffect(() => { isRidingRef.current = isRiding; }, [isRiding, isRidingRef]);

  const [simulatedSpin, setSimulatedSpin] = useState(0);
  const shouldSimulate = isRiding && (isTrainingMode || isGuestMode);

  useEffect(() => {
    if (!shouldSimulate) { if (!isRiding) setSimulatedSpin(0); return; }
    const id = setInterval(() => {
      // Read effort on demand (1Hz) rather than subscribing — the live value
      // changes on every telemetry commit and would churn this hook's render.
      const effort = useTelemetryStore.getState().snapshot.effort;
      setSimulatedSpin((prev) => prev + (10 + (Math.min(1000, effort) * 90) / 1000) / (45 * 60));
    }, 1000);
    return () => clearInterval(id);
  }, [shouldSimulate, isRiding]);

  useEffect(() => {
    useRewardsStore.setState({
      isSimulating: shouldSimulate,
      simulatedReward: simulatedSpin.toFixed(1),
    });
  }, [shouldSimulate, simulatedSpin]);

  // NOTE: This hook deliberately does NOT advance the ride clock. The
  // coordinator's 1Hz sample timer is the single writer of elapsedTime /
  // rideProgress for every ride mode (device, keyboard sim, practice) —
  // see coordinator.ts. A previous time-scaled clock driver lived here but
  // was dead code (never invoked by the page) and has been removed.
}
