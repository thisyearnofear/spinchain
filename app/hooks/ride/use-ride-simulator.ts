"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRideStore } from "@/app/stores/ride-store";
import { useRewardsStore } from "@/app/stores/rewards-store";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import type { useRideCoordinator } from "@/app/engines/use-ride-coordinator";
import type { ClassWithRoute } from "@/app/hooks/evm/use-class-data";

interface UseRideSimulatorParams {
  isRiding: boolean;
  isTrainingMode: boolean;
  isGuestMode: boolean;
  isPracticeMode: boolean;
  coordinator: ReturnType<typeof useRideCoordinator>;
  classDataRef: React.MutableRefObject<ClassWithRoute | null>;
}

export function useRideSimulator({
  isRiding,
  isTrainingMode,
  isGuestMode,
  coordinator,
  classDataRef,
}: UseRideSimulatorParams) {
  const isRidingRef = useRef(false);
  useEffect(() => { isRidingRef.current = isRiding; }, [isRiding]);

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

  const handleSimulatorMetrics = useCallback((metrics: {
    heartRate: number; power: number; cadence: number; speed: number;
    effort: number; distance?: number; timestamp?: number;
  }) => {
    coordinator.ingestSimulatorMetrics(metrics);

    const currentClassData = classDataRef.current;
    if (isRidingRef.current && currentClassData && metrics.cadence > 0) {
      const TARGET_CADENCE = 80;
      const cadenceRatio = Math.min(metrics.cadence / TARGET_CADENCE, 1.5);
      const tickSeconds = 0.5 * cadenceRatio;
      const SIMULATOR_DURATION_SECONDS = 3 * 60;
      const realDuration = (currentClassData.metadata?.duration || 45) * 60;
      const timeScale = realDuration / SIMULATOR_DURATION_SECONDS;
      const scaledTick = tickSeconds * timeScale;

      const newTime = useRideStore.getState().elapsedTime + scaledTick;
      const newProgress = Math.min((newTime / realDuration) * 100, 100);
      if (newProgress >= 100) {
        isRidingRef.current = false;
        useRideStore.setState({ isActive: false, rideProgress: 100, elapsedTime: Math.round(newTime) });
      } else {
        // Quantize the clock to whole seconds. newTime advances fractionally per
        // pedal event; writing it raw triggered a store update (→ page re-render)
        // AND a synchronous persisted localStorage write on every pedal stroke.
        const whole = Math.floor(newTime);
        const prevWhole = Math.floor(useRideStore.getState().elapsedTime);
        if (whole !== prevWhole) {
          useRideStore.setState({ elapsedTime: whole, rideProgress: newProgress });
        }
      }
    }
  }, [coordinator, classDataRef]);

  return {
    isRidingRef,
    handleSimulatorMetrics,
  };
}
