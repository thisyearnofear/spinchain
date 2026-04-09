"use client";

import { useEffect } from "react";
import { useRideFocusMode, useRideFocusConfig } from "./use-ride-focus-mode";

/**
 * Adapter hook to bridge the new unified focus mode with existing panel state
 * 
 * This allows gradual migration:
 * 1. New components use useRideFocusConfig() directly
 * 2. Existing components continue using their current props
 * 3. This adapter translates focus mode → legacy state
 * 
 * Once all components are migrated, this adapter can be removed.
 */

export function useRideFocusAdapter(deviceType: "mobile" | "tablet" | "desktop") {
  const config = useRideFocusConfig();
  const { initForDevice } = useRideFocusMode();
  
  // Initialize mode based on device on mount
  useEffect(() => {
    initForDevice(deviceType === "tablet" ? "mobile" : deviceType);
  }, [deviceType, initForDevice]);
  
  // Map focus config to legacy HUD mode
  const hudMode = (() => {
    switch (config.centerHud) {
      case "none":
        return "minimal";
      case "single":
      case "compact":
        return "compact";
      case "full":
        return "full";
      default:
        return "full";
    }
  })() as "full" | "compact" | "minimal";
  
  // Map focus config to legacy widget mode
  const widgetsMode = (() => {
    switch (config.bottomPanel) {
      case "none":
        return "minimized";
      case "interval-only":
        return "collapsed";
      case "interval-coach":
      case "full":
        return "expanded";
      default:
        return "expanded";
    }
  })() as "expanded" | "collapsed" | "minimized";
  
  // Map focus config to legacy view mode
  const viewMode = config.centerHud === "none" ? "focus" : "immersive";
  
  return {
    // Legacy compatibility
    hudMode,
    widgetsMode,
    viewMode,
    
    // New granular controls
    showTopBar: config.topBar !== "hidden",
    topBarStyle: config.topBar,
    showIntervalBanner: config.showIntervalBanner,
    showAiCoach: config.showAiCoach,
    showGhostPacer: config.showGhostPacer,
    showFlowBackground: config.showFlowBackground,
    
    // Direct config access
    config,
  };
}

/**
 * Hook to determine what should be visible based on focus mode
 * 
 * Use this in components to conditionally render based on focus mode:
 * 
 * const visibility = useRideFocusVisibility();
 * if (!visibility.showAiCoach) return null;
 */
export function useRideFocusVisibility() {
  const config = useRideFocusConfig();
  
  return {
    // Top bar elements
    showTopBar: config.topBar !== "hidden",
    showClassInfo: config.topBar === "full" || config.topBar === "status",
    showRewardBadge: config.topBar !== "hidden",
    showTimer: config.topBar !== "hidden",
    
    // Center HUD
    showCenterMetrics: config.centerHud !== "none",
    showAllMetrics: config.centerHud === "full",
    showCompactMetrics: config.centerHud === "compact" || config.centerHud === "single",
    showSingleMetric: config.centerHud === "single",
    
    // Bottom panel
    showBottomPanel: config.bottomPanel !== "none",
    showIntervalBanner: config.showIntervalBanner,
    showAiCoach: config.showAiCoach && config.bottomPanel !== "none",
    showRideControls: config.bottomPanel !== "none",
    
    // Overlays
    showGhostPacer: config.showGhostPacer,
    showFlowBackground: config.showFlowBackground,
    
    // Computed states
    isZenMode: config.topBar === "hidden" && config.centerHud === "none" && config.bottomPanel === "none",
    isMinimalMode: config.centerHud === "single" && config.bottomPanel === "interval-only",
  };
}
