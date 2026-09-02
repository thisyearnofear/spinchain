"use client";

import { useEffect, useRef, useState } from "react";
import type { FlowStateTier } from "@/app/lib/flow-state";

/**
 * useFlowCelebration — tracks flow tier escalations and exposes a
 * transient celebration effect (tier + startedAt) that auto-clears after 3s.
 *
 * Extracted from Scene (route-visualizer.tsx) as the first step of the
 * no-giant-component split. Keeps Scene focused on rendering, not tier timing.
 */
export function useFlowCelebration(flowTier: FlowStateTier) {
  const previousFlowTierRef = useRef<FlowStateTier | null>(null);
  const [currentFlowEffect, setCurrentFlowEffect] = useState<{
    tier: number;
    startedAt: number;
  } | null>(null);

  useEffect(() => {
    if (flowTier && flowTier > (previousFlowTierRef.current ?? 0)) {
      const celebration = {
        tier: flowTier,
        startedAt: performance.now(),
      };
      setCurrentFlowEffect(celebration);
      const t = setTimeout(() => {
        setCurrentFlowEffect((prev) =>
          prev && prev.startedAt < performance.now() - 3000 ? null : prev,
        );
      }, 3000);
      previousFlowTierRef.current = flowTier ?? 0;
      return () => clearTimeout(t);
    }
    previousFlowTierRef.current = flowTier ?? 0;
  }, [flowTier]);

  return currentFlowEffect;
}
