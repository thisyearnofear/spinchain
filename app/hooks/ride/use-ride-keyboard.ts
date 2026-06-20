"use client";

import { useEffect } from "react";
import { useUIStore } from "@/app/stores/ui-store";
import { useTelemetryStore } from "@/app/stores/telemetry-store";
import { useRideStore } from "@/app/stores/ride-store";
import { DEFAULT_ROAD_GEARS } from "@/app/lib/analytics/physiological-models";
import type { usePanelState } from "@/app/hooks/ui/use-panel-state";
import type { useRideCoordinator } from "@/app/engines/use-ride-coordinator";

interface UseRideKeyboardParams {
  isRiding: boolean;
  panelState: ReturnType<typeof usePanelState>;
  coordinator: ReturnType<typeof useRideCoordinator>;
  playSound: (type: unknown) => void;
}

export function useRideKeyboard({
  isRiding,
  panelState,
  coordinator,
  playSound,
}: UseRideKeyboardParams) {
  const cycleHudMode = useUIStore((s) => s.cycleHudMode);
  const toggleViewMode = useUIStore((s) => s.toggleViewMode);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        if (panelState.isAllCollapsed) panelState.expandAll();
        else panelState.collapseAll();
      } else if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        cycleHudMode();
      } else if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        toggleViewMode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [panelState, cycleHudMode, toggleViewMode]);

  useEffect(() => {
    if (typeof window === "undefined" || !isRiding) return;
    const totalGears = DEFAULT_ROAD_GEARS.front.length * DEFAULT_ROAD_GEARS.rear.length;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        useTelemetryStore.setState((s) => ({ currentGear: Math.min(totalGears, s.currentGear + 1) }));
        playSound?.("resistanceUp");
        coordinator.setCurrentGear(useTelemetryStore.getState().currentGear);
      } else if (e.key === "ArrowDown") {
        useTelemetryStore.setState((s) => ({ currentGear: Math.max(1, s.currentGear - 1) }));
        playSound?.("resistanceDown");
        coordinator.setCurrentGear(useTelemetryStore.getState().currentGear);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRiding, playSound, coordinator]);
}
