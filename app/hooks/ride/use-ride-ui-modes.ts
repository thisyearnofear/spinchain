"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePanelState } from "../../hooks/ui/use-panel-state";

type HudMode = "full" | "compact" | "minimal";
type ViewMode = "immersive" | "focus";
type DeviceType = "mobile" | "tablet" | "desktop";
type PerformanceTier = "high" | "medium" | "low";
type ModeSource = "system" | "stored" | "manual";

function getSystemHudMode(
  deviceType: DeviceType,
  orientation: "portrait" | "landscape",
  prefersReducedMotion: boolean,
): HudMode {
  if (prefersReducedMotion) return "minimal";
  if (deviceType === "mobile") return "compact";
  if (deviceType === "tablet") return orientation === "portrait" ? "compact" : "full";
  return "full";
}

function getSystemViewMode(
  deviceType: DeviceType,
  performanceTier: PerformanceTier,
  prefersReducedMotion: boolean,
): ViewMode {
  if (prefersReducedMotion) return "focus";
  return deviceType === "desktop" || performanceTier === "high" ? "immersive" : "focus";
}

export function useRideUIModes({
  deviceType,
  orientation,
  performanceTier,
  isRiding,
  rideProgress,
}: {
  deviceType: DeviceType;
  orientation: "portrait" | "landscape";
  performanceTier: PerformanceTier;
  isRiding: boolean;
  rideProgress: number;
}) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [hudMode, setHudMode] = useState<HudMode>("full");
  const [viewMode, setViewMode] = useState<ViewMode>("immersive");
  const hudModePreferenceRef = useRef<ModeSource>("system");
  const viewModePreferenceRef = useRef<ModeSource>("system");

  const panelState = usePanelState(deviceType);

  const [widgetsMode, setWidgetsMode] = useState<"expanded" | "collapsed" | "minimized">("expanded");

  // Reduced motion detection
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const apply = () => setPrefersReducedMotion(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  // Persisted preferences
  useEffect(() => {
    try {
      const storedHud = window.localStorage.getItem("spinchain:ride:hudMode");
      if (storedHud === "full" || storedHud === "compact" || storedHud === "minimal") {
        hudModePreferenceRef.current = "stored";
        setHudMode(storedHud);
      }
      const storedView = window.localStorage.getItem("spinchain:ride:viewMode");
      if (storedView === "focus" || storedView === "immersive") {
        viewModePreferenceRef.current = "stored";
        setViewMode(storedView);
      }
    } catch { /* ignore */ }
  }, []);

  // Auto-adjust when following system defaults
  useEffect(() => {
    if (hudModePreferenceRef.current === "system") {
      setHudMode(getSystemHudMode(deviceType, orientation, prefersReducedMotion));
    }
    if (viewModePreferenceRef.current === "system") {
      setViewMode(getSystemViewMode(deviceType, performanceTier, prefersReducedMotion));
    }
  }, [deviceType, orientation, performanceTier, prefersReducedMotion]);

  // Panel state management
  useEffect(() => {
    if (isRiding) panelState.startRideLayout();
    else panelState.endRideLayout();
  }, [isRiding, panelState]);

  const applyHudMode = useCallback(
    (next: HudMode, source: ModeSource) => {
      setHudMode(next);
      hudModePreferenceRef.current = source;
      if (source === "manual") {
        try { window.localStorage.setItem("spinchain:ride:hudMode", next); } catch { /* ignore */ }
      }
    },
    [],
  );

  const applyViewMode = useCallback(
    (next: ViewMode, source: ModeSource) => {
      setViewMode(next);
      viewModePreferenceRef.current = source;
      if (source === "manual") {
        try { window.localStorage.setItem("spinchain:ride:viewMode", next); } catch { /* ignore */ }
      }
    },
    [],
  );

  const cycleHudMode = useCallback(() => {
    const next = hudMode === "full" ? "compact" : hudMode === "compact" ? "minimal" : "full";
    applyHudMode(next, "manual");
  }, [hudMode, applyHudMode]);

  const cycleRideWidgetsMode = useCallback(() => {
    setWidgetsMode((prev) =>
      prev === "expanded" ? "collapsed" : prev === "collapsed" ? "minimized" : "expanded",
    );
  }, []);

  const resetPrefs = useCallback(() => {
    try {
      window.localStorage.removeItem("spinchain:ride:viewMode");
      window.localStorage.removeItem("spinchain:ride:hudMode");
    } catch { /* ignore */ }
    hudModePreferenceRef.current = "system";
    viewModePreferenceRef.current = "system";
    applyHudMode(getSystemHudMode(deviceType, orientation, prefersReducedMotion), "system");
    applyViewMode(getSystemViewMode(deviceType, performanceTier, prefersReducedMotion), "system");
    panelState.resetLayout();
  }, [deviceType, orientation, performanceTier, prefersReducedMotion, applyHudMode, applyViewMode, panelState]);

  const handleTogglePanel = useCallback(
    (key: Parameters<typeof panelState.toggle>[0]) => {
      if (deviceType === "mobile") {
        const isCurrentlyExpanded = panelState.state[key] === "expanded";
        if (isCurrentlyExpanded) panelState.collapse(key);
        else panelState.expandOne(key);
      } else {
        panelState.toggle(key);
      }
    },
    [deviceType, panelState],
  );

  const widgetsVisible = !isRiding || widgetsMode !== "minimized";

  return {
    hudMode,
    viewMode,
    prefersReducedMotion,
    panelState,
    widgetsMode,
    widgetsVisible,
    applyHudMode,
    applyViewMode,
    cycleHudMode,
    cycleRideWidgetsMode,
    resetPrefs,
    handleTogglePanel,
  };
}