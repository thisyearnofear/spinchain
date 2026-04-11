"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useCallback, useMemo } from "react";

/**
 * Unified Ride Focus Mode - replaces the fragmented 3-axis control system
 * 
 * Single mental model: 4 clearly named presets that define what's visible
 * across all layers (HUD, bottom panel, top bar)
 * 
 * CORE PRINCIPLE: Per-metric customization extends focus modes, not replaces them.
 * Users start with presets, then optionally customize visible metrics.
 */

export type RideFocusMode = "zen" | "immersive" | "balanced" | "data";

// Available metrics for display
export type MetricKey = "power" | "heartRate" | "cadence" | "speed" | "effort" | "gear" | "wBal";

export interface MetricConfig {
  key: MetricKey;
  label: string;
  unit: string;
  color: string;
  visible: boolean;
  priority: number; // Lower = higher priority (displayed first)
}

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
  
  // Per-metric customization (Priority 4: Per-metric customization)
  // Each focus mode has its own metric config, but user can override
  metrics: MetricConfig[];
  useCustomMetrics: boolean; // When true, use custom config instead of preset
}

// Default metric configurations for each focus mode
const DEFAULT_METRICS: MetricConfig[] = [
  { key: "power", label: "Power", unit: "W", color: "text-yellow-400", visible: true, priority: 1 },
  { key: "heartRate", label: "Heart Rate", unit: "BPM", color: "text-rose-400", visible: true, priority: 2 },
  { key: "cadence", label: "Cadence", unit: "RPM", color: "text-blue-400", visible: true, priority: 3 },
  { key: "speed", label: "Speed", unit: "km/h", color: "text-emerald-400", visible: true, priority: 4 },
  { key: "effort", label: "Effort", unit: "%", color: "text-orange-400", visible: false, priority: 5 },
  { key: "gear", label: "Gear", unit: "", color: "text-cyan-400", visible: true, priority: 6 },
  { key: "wBal", label: "W'Bal", unit: "kJ", color: "text-purple-400", visible: false, priority: 7 },
];

// Helper to get metrics for a specific mode
function getPresetMetrics(mode: RideFocusMode): MetricConfig[] {
  const base = [...DEFAULT_METRICS];
  
  switch (mode) {
    case "zen":
      // Zen mode: all metrics hidden (user sees pure experience)
      return base.map(m => ({ ...m, visible: false }));
    case "immersive":
      // Immersive: only essential metrics, power primary
      return base.map(m => ({ 
        ...m, 
        visible: ["power", "heartRate"].includes(m.key),
        priority: m.key === "power" ? 1 : m.key === "heartRate" ? 2 : m.priority
      }));
    case "balanced":
      // Balanced: standard set (4 core metrics only for clean default)
      return base.map(m => ({ ...m, visible: ["power", "heartRate", "cadence", "speed"].includes(m.key) }));
    case "data":
      // Data: everything visible
      return base.map(m => ({ ...m, visible: true }));
  }
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
    metrics: getPresetMetrics("zen"),
    useCustomMetrics: false,
  },
  immersive: {
    topBar: "minimal",
    centerHud: "single",
    bottomPanel: "interval-only",
    showIntervalBanner: true,
    showAiCoach: false,
    showGhostPacer: true,
    showFlowBackground: true,
    metrics: getPresetMetrics("immersive"),
    useCustomMetrics: false,
  },
  balanced: {
    topBar: "status",
    centerHud: "compact",
    bottomPanel: "interval-coach",
    showIntervalBanner: true,
    showAiCoach: true,
    showGhostPacer: true,
    showFlowBackground: true,
    metrics: getPresetMetrics("balanced"),
    useCustomMetrics: false,
  },
  data: {
    topBar: "full",
    centerHud: "full",
    bottomPanel: "full",
    showIntervalBanner: true,
    showAiCoach: true,
    showGhostPacer: true,
    showFlowBackground: false,
    metrics: getPresetMetrics("data"),
    useCustomMetrics: false,
  },
};

interface RideFocusStore {
  // Current mode
  mode: RideFocusMode;
  
  // Device-specific defaults
  mobileDefault: RideFocusMode;
  desktopDefault: RideFocusMode;
  
  // Current config (derived from mode + customizations)
  config: RideFocusConfig;
  
  // Per-mode custom overrides (Priority 4: user-customized metric configs per mode)
  customConfigs: Partial<Record<RideFocusMode, Pick<RideFocusConfig, "metrics" | "useCustomMetrics">>>;
  
  // Actions
  setMode: (mode: RideFocusMode) => void;
  cycleMode: () => void;
  toggleZen: () => void;
  
  // Granular overrides (for advanced users)
  togglePanel: (panel: keyof Pick<RideFocusConfig, "showIntervalBanner" | "showAiCoach" | "showGhostPacer">) => void;
  
  // Per-metric customization (Priority 4)
  toggleMetricVisibility: (metricKey: MetricKey) => void;
  setMetricPriority: (metricKey: MetricKey, newPriority: number) => void;
  reorderMetrics: (fromIndex: number, toIndex: number) => void;
  resetMetricsToPreset: () => void;
  enableCustomMetrics: (enabled: boolean) => void;
  
  // Device-specific initialization
  initForDevice: (deviceType: "mobile" | "desktop") => void;
}

const MODE_CYCLE: RideFocusMode[] = ["zen", "immersive", "balanced", "data"];

// Helper to build config with custom overrides
function buildConfig(
  mode: RideFocusMode,
  customConfigs: Partial<Record<RideFocusMode, Pick<RideFocusConfig, "metrics" | "useCustomMetrics">>>
): RideFocusConfig {
  const preset = FOCUS_PRESETS[mode];
  const custom = customConfigs[mode];
  
  if (custom?.useCustomMetrics && custom.metrics) {
    return { ...preset, ...custom };
  }
  return preset;
}

export const useRideFocusMode = create<RideFocusStore>()(
  persist(
    (set, get) => ({
      mode: "balanced",
      mobileDefault: "immersive",
      desktopDefault: "balanced",
      config: FOCUS_PRESETS.balanced,
      customConfigs: {},
      
      setMode: (mode) => set({ 
        mode, 
        config: buildConfig(mode, get().customConfigs) 
      }),
      
      cycleMode: () => {
        const current = get().mode;
        const currentIndex = MODE_CYCLE.indexOf(current);
        const nextIndex = (currentIndex + 1) % MODE_CYCLE.length;
        const nextMode = MODE_CYCLE[nextIndex];
        set({ 
          mode: nextMode, 
          config: buildConfig(nextMode, get().customConfigs) 
        });
      },
      
      toggleZen: () => {
        const current = get().mode;
        const nextMode = current === "zen" ? get().mobileDefault : "zen";
        set({ 
          mode: nextMode, 
          config: buildConfig(nextMode, get().customConfigs) 
        });
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
      
      // Priority 4: Per-metric customization
      toggleMetricVisibility: (metricKey) => {
        const currentMode = get().mode;
        const currentCustom = get().customConfigs[currentMode];
        const currentMetrics = currentCustom?.useCustomMetrics 
          ? currentCustom.metrics! 
          : [...FOCUS_PRESETS[currentMode].metrics];
        
        const updatedMetrics = currentMetrics.map(m => 
          m.key === metricKey ? { ...m, visible: !m.visible } : m
        );
        
        const newCustomConfigs = {
          ...get().customConfigs,
          [currentMode]: { useCustomMetrics: true, metrics: updatedMetrics }
        };
        
        set({
          customConfigs: newCustomConfigs,
          config: buildConfig(currentMode, newCustomConfigs)
        });
      },
      
      setMetricPriority: (metricKey, newPriority) => {
        const currentMode = get().mode;
        const currentCustom = get().customConfigs[currentMode];
        const currentMetrics = currentCustom?.useCustomMetrics 
          ? currentCustom.metrics! 
          : [...FOCUS_PRESETS[currentMode].metrics];
        
        const updatedMetrics = currentMetrics.map(m => 
          m.key === metricKey ? { ...m, priority: newPriority } : m
        );
        
        const newCustomConfigs = {
          ...get().customConfigs,
          [currentMode]: { useCustomMetrics: true, metrics: updatedMetrics }
        };
        
        set({
          customConfigs: newCustomConfigs,
          config: buildConfig(currentMode, newCustomConfigs)
        });
      },
      
      reorderMetrics: (fromIndex, toIndex) => {
        const currentMode = get().mode;
        const currentCustom = get().customConfigs[currentMode];
        const currentMetrics = currentCustom?.useCustomMetrics 
          ? [...currentCustom.metrics!] 
          : [...FOCUS_PRESETS[currentMode].metrics];
        
        // Remove from old position and insert at new position
        const [moved] = currentMetrics.splice(fromIndex, 1);
        currentMetrics.splice(toIndex, 0, moved);
        
        // Update priority values to match new order
        const updatedMetrics = currentMetrics.map((m, idx) => ({
          ...m,
          priority: idx + 1
        }));
        
        const newCustomConfigs = {
          ...get().customConfigs,
          [currentMode]: { useCustomMetrics: true, metrics: updatedMetrics }
        };
        
        set({
          customConfigs: newCustomConfigs,
          config: buildConfig(currentMode, newCustomConfigs)
        });
      },
      
      resetMetricsToPreset: () => {
        const currentMode = get().mode;
        const { [currentMode]: _, ...remainingCustomConfigs } = get().customConfigs;
        
        set({
          customConfigs: remainingCustomConfigs,
          config: FOCUS_PRESETS[currentMode]
        });
      },
      
      enableCustomMetrics: (enabled) => {
        const currentMode = get().mode;
        
        if (enabled) {
          // Copy preset metrics as starting point for customization
          const newCustomConfigs = {
            ...get().customConfigs,
            [currentMode]: { 
              useCustomMetrics: true, 
              metrics: [...FOCUS_PRESETS[currentMode].metrics] 
            }
          };
          set({
            customConfigs: newCustomConfigs,
            config: buildConfig(currentMode, newCustomConfigs)
          });
        } else {
          // Disable custom metrics - revert to preset
          const { [currentMode]: _, ...remainingCustomConfigs } = get().customConfigs;
          set({
            customConfigs: remainingCustomConfigs,
            config: FOCUS_PRESETS[currentMode]
          });
        }
      },
      
      initForDevice: (deviceType) => {
        const currentMode = get().mode;
        const defaultMode =
          deviceType === "mobile" ? get().mobileDefault : get().desktopDefault;

        // Only set if current mode is different from default (avoid infinite loops/re-render churn)
        if (currentMode !== defaultMode) {
          set({
            mode: defaultMode,
            config: buildConfig(defaultMode, get().customConfigs),
          });
        }
      },
    }),
    {
      name: "ride-focus-mode",
      partialize: (state) => ({
        mobileDefault: state.mobileDefault,
        desktopDefault: state.desktopDefault,
        customConfigs: state.customConfigs, // Persist custom metric configs
      }),
    }
  )
);

// Convenience hooks for components
export const useRideFocusConfig = () => useRideFocusMode((state) => state.config);
export const useIsZenMode = () => useRideFocusMode((state) => state.mode === "zen");
export const useRideFocusModeValue = () => useRideFocusMode((state) => state.mode);
export const useCustomMetrics = () => useRideFocusMode((state) => ({
  useCustomMetrics: state.config.useCustomMetrics,
  metrics: state.config.metrics,
  // Expose actions
  toggleMetricVisibility: state.toggleMetricVisibility,
  setMetricPriority: state.setMetricPriority,
  reorderMetrics: state.reorderMetrics,
  resetMetricsToPreset: state.resetMetricsToPreset,
  enableCustomMetrics: state.enableCustomMetrics,
}));

// Keyboard shortcut handler
export function useRideFocusKeyboard(options?: {
  onPauseResume?: () => void;
}) {
  const { cycleMode, toggleZen, togglePanel, setMode } = useRideFocusMode();
  
  return useCallback((event: KeyboardEvent) => {
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
  }, [cycleMode, toggleZen, togglePanel, setMode, options?.onPauseResume]);
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
