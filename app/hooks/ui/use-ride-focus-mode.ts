"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Unified Ride Focus Mode - replaces the fragmented 3-axis control system
 * 
 * Single mental model: 4 clearly named presets that define what's visible
 * across all layers (HUD, bottom panel, top bar)
 */

export type RideFocusMode = "zen" | "immersive" | "balanced" | "data";

interface RideFocusConfig {
  // Top bar visibility
  topBar: "hidden" | "minimal" | "status" | "full";
  
  // Center HUD (metrics overlay on 3D scene)
  centerHud: "none" | "single" | "compact" | "full";
  
  // Bottom panel (interval, AI coach, controls)
  bottomPanel: "none" | "interval-only" | "interval-coach" | "full";
  
  // Individual panel toggles (for granular control)
  showIntervalBanner: boolean;
  showAiCoach: boolean;
  showGhostPacer: boolean;
  showFlowBackground: boolean;
}

const FOCUS_PRESETS: Record<RideFocusMode, RideFocusConfig> = {
  zen: {
    topBar: "hidden",
    centerHud: "none",
    bottomPanel: "none",
    showIntervalBanner: false,
    showAiCoach: false,
    showGhostPacer: false,
    showFlowBackground: true,
  },
  immersive: {
    topBar: "minimal",
    centerHud: "single",
    bottomPanel: "interval-only",
    showIntervalBanner: true,
    showAiCoach: false,
    showGhostPacer: true,
    showFlowBackground: true,
  },
  balanced: {
    topBar: "status",
    centerHud: "compact",
    bottomPanel: "interval-coach",
    showIntervalBanner: true,
    showAiCoach: true,
    showGhostPacer: true,
    showFlowBackground: true,
  },
  data: {
    topBar: "full",
    centerHud: "full",
    bottomPanel: "full",
    showIntervalBanner: true,
    showAiCoach: true,
    showGhostPacer: true,
    showFlowBackground: false,
  },
};

interface RideFocusStore {
  // Current mode
  mode: RideFocusMode;
  
  // Device-specific defaults
  mobileDefault: RideFocusMode;
  desktopDefault: RideFocusMode;
  
  // Current config (derived from mode)
  config: RideFocusConfig;
  
  // Actions
  setMode: (mode: RideFocusMode) => void;
  cycleMode: () => void;
  toggleZen: () => void;
  
  // Granular overrides (for advanced users)
  togglePanel: (panel: keyof Pick<RideFocusConfig, "showIntervalBanner" | "showAiCoach" | "showGhostPacer">) => void;
  
  // Device-specific initialization
  initForDevice: (deviceType: "mobile" | "desktop") => void;
}

const MODE_CYCLE: RideFocusMode[] = ["zen", "immersive", "balanced", "data"];

export const useRideFocusMode = create<RideFocusStore>()(
  persist(
    (set, get) => ({
      mode: "balanced",
      mobileDefault: "immersive",
      desktopDefault: "balanced",
      config: FOCUS_PRESETS.balanced,
      
      setMode: (mode) => set({ mode, config: FOCUS_PRESETS[mode] }),
      
      cycleMode: () => {
        const current = get().mode;
        const currentIndex = MODE_CYCLE.indexOf(current);
        const nextIndex = (currentIndex + 1) % MODE_CYCLE.length;
        const nextMode = MODE_CYCLE[nextIndex];
        set({ mode: nextMode, config: FOCUS_PRESETS[nextMode] });
      },
      
      toggleZen: () => {
        const current = get().mode;
        const nextMode = current === "zen" ? get().mobileDefault : "zen";
        set({ mode: nextMode, config: FOCUS_PRESETS[nextMode] });
      },
      
      togglePanel: (panel) => {
        const currentConfig = get().config;
        set({
          config: {
            ...currentConfig,
            [panel]: !currentConfig[panel],
          },
        });
      },
      
      initForDevice: (deviceType) => {
        const defaultMode = deviceType === "mobile" ? get().mobileDefault : get().desktopDefault;
        set({ mode: defaultMode, config: FOCUS_PRESETS[defaultMode] });
      },
    }),
    {
      name: "ride-focus-mode",
      partialize: (state) => ({
        mobileDefault: state.mobileDefault,
        desktopDefault: state.desktopDefault,
      }),
    }
  )
);

// Convenience hooks for components
export const useRideFocusConfig = () => useRideFocusMode((state) => state.config);
export const useIsZenMode = () => useRideFocusMode((state) => state.mode === "zen");

// Keyboard shortcut handler
export function useRideFocusKeyboard(options?: {
  onPauseResume?: () => void;
}) {
  const { cycleMode, toggleZen, togglePanel, setMode } = useRideFocusMode();
  
  return (event: KeyboardEvent) => {
    // Ignore if typing in input
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }
    
    switch (event.key.toLowerCase()) {
      case "z":
        event.preventDefault();
        toggleZen();
        break;
      case "h":
        event.preventDefault();
        cycleMode();
        break;
      case "i":
        event.preventDefault();
        togglePanel("showIntervalBanner");
        break;
      case "a":
        event.preventDefault();
        togglePanel("showAiCoach");
        break;
      case "g":
        event.preventDefault();
        togglePanel("showGhostPacer");
        break;
      case " ": // Space key for pause/resume
        if (options?.onPauseResume) {
          event.preventDefault();
          options.onPauseResume();
        }
        break;
      // Priority 5: Individual metric toggles (1-4)
      case "1":
        event.preventDefault();
        setMode("zen");
        break;
      case "2":
        event.preventDefault();
        setMode("immersive");
        break;
      case "3":
        event.preventDefault();
        setMode("balanced");
        break;
      case "4":
        event.preventDefault();
        setMode("data");
        break;
      // Tab for quick peek (handled by component)
      case "tab":
        // Prevent default tab behavior during ride
        if (document.body.classList.contains("ride-active")) {
          event.preventDefault();
        }
        break;
    }
  };
}

// Mobile gesture handler for progressive disclosure
export function useRideFocusGestures() {
  const { mode, setMode } = useRideFocusMode();
  
  return {
    onSwipeUp: () => {
      // Swipe up: progressively reveal more
      const progression: RideFocusMode[] = ["zen", "immersive", "balanced", "data"];
      const currentIndex = progression.indexOf(mode);
      if (currentIndex < progression.length - 1) {
        setMode(progression[currentIndex + 1]);
      }
    },
    onSwipeDown: () => {
      // Swipe down: progressively hide
      const progression: RideFocusMode[] = ["zen", "immersive", "balanced", "data"];
      const currentIndex = progression.indexOf(mode);
      if (currentIndex > 0) {
        setMode(progression[currentIndex - 1]);
      }
    },
    onLongPress: () => {
      // Long-press 3D scene: instant zen toggle
      const { toggleZen } = useRideFocusMode.getState();
      toggleZen();
    },
  };
}

// Mode metadata for UI
export const FOCUS_MODE_META: Record<RideFocusMode, {
  icon: string;
  label: string;
  description: string;
  color: string;
}> = {
  zen: {
    icon: "🧘",
    label: "Zen",
    description: "Pure ride experience",
    color: "text-purple-400",
  },
  immersive: {
    icon: "🔥",
    label: "Immersive",
    description: "Focused training",
    color: "text-orange-400",
  },
  balanced: {
    icon: "📊",
    label: "Balanced",
    description: "Guided workouts",
    color: "text-blue-400",
  },
  data: {
    icon: "📈",
    label: "Data",
    description: "All metrics visible",
    color: "text-green-400",
  },
};
