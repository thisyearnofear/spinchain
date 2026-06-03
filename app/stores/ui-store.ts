/**
 * UI Store — Ride UI preferences and modal state.
 *
 * Manages HUD mode, view mode, widget visibility, modals, and
 * device connection state. Persists preferences to localStorage.
 *
 * Design rules:
 * - This store owns all UI-only state (no telemetry, no business logic).
 * - Components read directly; the page does not need to pass these as props.
 * - localStorage persistence is built into the store (not scattered in useEffect).
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type HudMode = "full" | "compact" | "minimal";
type ViewMode = "immersive" | "focus";
type WidgetMode = "expanded" | "collapsed" | "minimized";
type DeviceType = "mobile" | "tablet" | "desktop";

interface UIState {
  hudMode: HudMode;
  viewMode: ViewMode;
  widgetsMode: WidgetMode;
  widgetsVisible: boolean;
  prefersReducedMotion: boolean;
  showNoBikeModal: boolean;
  showKeyboardHints: boolean;
  showDemoModal: boolean;
  showMilestone: { title: string; subtitle: string } | null;
  connectionHint: string | null;
  bleConnected: boolean;
  useSimulator: boolean;
  isPracticeMode: boolean;
  isGuestMode: boolean;
  isTrainingMode: boolean;
  deviceType: DeviceType;
  orientation: "portrait" | "landscape";
}

interface UIActions {
  setHudMode: (mode: HudMode) => void;
  cycleHudMode: () => void;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
  setWidgetsMode: (mode: WidgetMode) => void;
  cycleWidgetsMode: () => void;
  setWidgetsVisible: (visible: boolean) => void;
  setPrefersReducedMotion: (prefers: boolean) => void;
  setShowNoBikeModal: (show: boolean) => void;
  setShowKeyboardHints: (show: boolean) => void;
  setShowDemoModal: (show: boolean) => void;
  setShowMilestone: (milestone: { title: string; subtitle: string } | null) => void;
  setConnectionHint: (hint: string | null) => void;
  setBleConnected: (connected: boolean) => void;
  setUseSimulator: (use: boolean) => void;
  setIsPracticeMode: (practice: boolean) => void;
  setIsGuestMode: (guest: boolean) => void;
  setIsTrainingMode: (training: boolean) => void;
  setDeviceType: (type: DeviceType) => void;
  setOrientation: (orientation: "portrait" | "landscape") => void;
  resetPrefs: () => void;
  reset: () => void;
}

const initialState: UIState = {
  hudMode: "full",
  viewMode: "immersive",
  widgetsMode: "expanded",
  widgetsVisible: true,
  prefersReducedMotion: false,
  showNoBikeModal: false,
  showKeyboardHints: false,
  showDemoModal: false,
  showMilestone: null,
  connectionHint: null,
  bleConnected: false,
  useSimulator: false,
  isPracticeMode: false,
  isGuestMode: false,
  isTrainingMode: false,
  deviceType: "desktop",
  orientation: "landscape",
};

export const useUIStore = create<UIState & UIActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setHudMode: (mode) => set({ hudMode: mode }),
      cycleHudMode: () => {
        const { hudMode } = get();
        const next = hudMode === "full" ? "compact" : hudMode === "compact" ? "minimal" : "full";
        set({ hudMode: next });
      },
      setViewMode: (mode) => set({ viewMode: mode }),
      toggleViewMode: () => {
        const { viewMode } = get();
        set({ viewMode: viewMode === "immersive" ? "focus" : "immersive" });
      },
      setWidgetsMode: (mode) => set({ widgetsMode: mode }),
      cycleWidgetsMode: () => {
        const { widgetsMode } = get();
        const next =
          widgetsMode === "expanded"
            ? "collapsed"
            : widgetsMode === "collapsed"
              ? "minimized"
              : "expanded";
        set({ widgetsMode: next });
      },
      setWidgetsVisible: (visible) => set({ widgetsVisible: visible }),
      setPrefersReducedMotion: (prefers) => set({ prefersReducedMotion: prefers }),
      setShowNoBikeModal: (show) => set({ showNoBikeModal: show }),
      setShowKeyboardHints: (show) => set({ showKeyboardHints: show }),
      setShowDemoModal: (show) => set({ showDemoModal: show }),
      setShowMilestone: (milestone) => set({ showMilestone: milestone }),
      setConnectionHint: (hint) => set({ connectionHint: hint }),
      setBleConnected: (connected) => set({ bleConnected: connected }),
      setUseSimulator: (use) => set({ useSimulator: use }),
      setIsPracticeMode: (practice) => set({ isPracticeMode: practice }),
      setIsGuestMode: (guest) => set({ isGuestMode: guest }),
      setIsTrainingMode: (training) => set({ isTrainingMode: training }),
      setDeviceType: (type) => set({ deviceType: type }),
      setOrientation: (orientation) => set({ orientation }),

      resetPrefs: () =>
        set({
          hudMode: initialState.hudMode,
          viewMode: initialState.viewMode,
          widgetsMode: initialState.widgetsMode,
        }),

      reset: () => set(initialState),
    }),
    {
      name: "spinchain-ride-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        hudMode: state.hudMode,
        viewMode: state.viewMode,
      }),
    },
  ),
);

// ─── Granular Selectors ──────────────────────────────────────────

export const selectHudMode = (s: UIState) => s.hudMode;
export const selectViewMode = (s: UIState) => s.viewMode;
export const selectWidgetsMode = (s: UIState) => s.widgetsMode;
export const selectWidgetsVisible = (s: UIState) => s.widgetsVisible;
export const selectBleConnected = (s: UIState) => s.bleConnected;
export const selectUseSimulator = (s: UIState) => s.useSimulator;
export const selectIsPracticeMode = (s: UIState) => s.isPracticeMode;
