"use client";

import { useEffect } from "react";
import { useUIStore } from "@/app/stores/ui-store";
import { shiftGear } from "@/app/lib/gear-shift";
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
    const handleKeyDown = (e: KeyboardEvent) => {
      // When the on-screen pedal simulator is driving input, ↑/↓ mean "pedal",
      // not "shift gear" — don't also fire a gear change + resistance sound on
      // every pedal stroke.
      if (useUIStore.getState().useSimulator) return;
      if (e.key === "ArrowUp") {
        shiftGear(1, coordinator.setCurrentGear);
        playSound?.("resistanceUp");
      } else if (e.key === "ArrowDown") {
        shiftGear(-1, coordinator.setCurrentGear);
        playSound?.("resistanceDown");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRiding, playSound, coordinator]);
}
