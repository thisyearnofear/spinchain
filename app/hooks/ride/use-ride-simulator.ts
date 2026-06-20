"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRideStore } from "@/app/stores/ride-store";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import type { useRideCoordinator } from "@/app/engines/use-ride-coordinator";
import type { ClassWithRoute } from "@/app/hooks/evm/use-class-data";

interface UseRideSimulatorParams {
  isRiding: boolean;
  isTrainingMode: boolean;
  isGuestMode: boolean;
  isPracticeMode: boolean;
  telemetryEffort: number;
  coordinator: ReturnType<typeof useRideCoordinator>;
  classDataRef: React.MutableRefObject<ClassWithRoute | null>;
}

export function useRideSimulator({
  isRiding,
  isTrainingMode,
  isGuestMode,
  isPracticeMode,
  telemetryEffort,
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
      setSimulatedSpin((prev) => prev + (10 + (Math.min(1000, telemetryEffort) * 90) / 1000) / (45 * 60));
    }, 1000);
    return () => clearInterval(id);
  }, [shouldSimulate, isRiding, telemetryEffort]);

  const resetSimulatedSpin = useCallback(() => setSimulatedSpin(0), []);
  const simulatedRewards = useMemo(() => ({
    simulatedReward: simulatedSpin,
    isSimulating: shouldSimulate,
    formattedReward: simulatedSpin.toFixed(1),
    reset: resetSimulatedSpin,
  }), [simulatedSpin, shouldSimulate, resetSimulatedSpin]);

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
        useRideStore.setState({ isActive: false, rideProgress: 100, elapsedTime: newTime });
      } else {
        useRideStore.setState({ elapsedTime: newTime, rideProgress: newProgress });
      }
    }
  }, [coordinator, classDataRef]);

  return {
    isRidingRef,
    simulatedRewards,
    handleSimulatorMetrics,
  };
}
