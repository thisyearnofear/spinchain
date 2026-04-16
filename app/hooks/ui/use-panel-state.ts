"use client";

/**
 * usePanelState - Centralized state management for collapsible UI panels
 *
 * Core Principles:
 * - DRY: Single source of truth for all collapsible panel state
 * - CLEAN: Hook handles state/persistence, components handle presentation
 * - MODULAR: Independently testable, composable
 * - PERFORMANT: Single localStorage read on mount, writes on change only
 *
 * Usage:
 *   const { state, toggle, expandAll, collapseAll } = usePanelState(deviceType);
 *   // state.workoutPlan === true means EXPANDED, false means COLLAPSED
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export type WidgetMode = 'expanded' | 'collapsed' | 'minimized';

export interface PanelState {
  // Pre-ride setup panels
  workoutPlan: WidgetMode;
  inputMode: WidgetMode;
  deviceSelector: WidgetMode;
  // Global mobile in-ride widget visibility
  mobileRideWidgets: WidgetMode;
  // Focus View panels
  focusLeft: WidgetMode;
  focusRight: WidgetMode;
  focusBottom: WidgetMode;
}

export type PanelKey = keyof PanelState;
export type DesktopPanelKey = 'focusLeft' | 'focusRight' | 'focusBottom';

export interface PanelPosition {
  x: number;
  y: number;
}

export type PanelPositions = Record<DesktopPanelKey, PanelPosition>;

type PanelStorageState = {
  state: PanelState;
  positions: PanelPositions;
};

const STORAGE_KEY = 'spinchain:ride:panelState';

function getDefaultPositions(): PanelPositions {
  return {
    focusLeft: { x: 16, y: 16 },
    focusRight: { x: -16, y: 16 },
    focusBottom: { x: 0, y: -16 },
  };
}

const PANEL_EDGE_MARGIN = 16;
const PANEL_EDGE_SNAP_THRESHOLD = 24;
const PANEL_APPROX_SIZE = {
  sideWidth: 416,
  sideHeight: 520,
  bottomWidth: 1216,
  bottomHeight: 256,
} as const;

function clamp(value: number, min: number, max: number) {
  if (min > max) return min;
  return Math.min(max, Math.max(min, value));
}

// Default states based on device type
function getDefaultState(deviceType: 'mobile' | 'tablet' | 'desktop'): PanelState {
  const allExpanded: PanelState = {
    workoutPlan: 'expanded',
    inputMode: 'expanded',
    deviceSelector: 'expanded',
    mobileRideWidgets: 'expanded',
    focusLeft: 'expanded',
    focusRight: 'expanded',
    focusBottom: 'expanded',
  };

  const allCollapsed: PanelState = {
    workoutPlan: 'collapsed',
    inputMode: 'collapsed',
    deviceSelector: 'collapsed',
    mobileRideWidgets: 'collapsed',
    focusLeft: 'collapsed',
    focusRight: 'collapsed',
    focusBottom: 'collapsed',
  };

  // Mobile: collapse by default (limited screen space)
  // Desktop: expand by default
  // Tablet: expand in landscape, collapse in portrait (handled by orientation check in component)
  if (deviceType === 'mobile') {
    // On mobile, keep essential panels expanded
    return {
      ...allCollapsed,
      workoutPlan: 'expanded', // Keep workout selector visible
      inputMode: 'expanded',   // Keep input mode visible
    };
  }

  return allExpanded;
}

function toPosition(value: unknown, fallback: PanelPosition): PanelPosition {
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as { x?: unknown; y?: unknown };
  const x = typeof candidate.x === 'number' ? candidate.x : fallback.x;
  const y = typeof candidate.y === 'number' ? candidate.y : fallback.y;
  return { x, y };
}

function migrateStoredPositions(stored: Record<string, unknown>): PanelPositions {
  const defaults = getDefaultPositions();
  return {
    focusLeft: toPosition(stored.focusLeft, defaults.focusLeft),
    focusRight: toPosition(stored.focusRight, defaults.focusRight),
    focusBottom: toPosition(stored.focusBottom, defaults.focusBottom),
  };
}

function loadStoredState(): PanelStorageState | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      if ('state' in parsed) {
        const typed = parsed as { state?: Record<string, unknown>; positions?: Record<string, unknown> };
        return {
          state: {
            ...getDefaultState('desktop'),
            ...migrateStoredState(typed.state ?? {}),
          },
          positions: {
            ...getDefaultPositions(),
            ...migrateStoredPositions(typed.positions ?? {}),
          },
        };
      }

      return {
        state: {
          ...getDefaultState('desktop'),
          ...migrateStoredState(parsed),
        },
        positions: getDefaultPositions(),
      };
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveStoredState(storageState: PanelStorageState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storageState));
  } catch {
    // Ignore storage errors
  }
}

function toMode(value: unknown): WidgetMode {
  if (value === 'expanded' || value === 'collapsed' || value === 'minimized') return value;
  if (value === true) return 'expanded';
  if (value === false) return 'collapsed';
  return 'expanded';
}

function migrateStoredState(stored: Record<string, unknown>): Partial<PanelState> {
  return {
    workoutPlan: toMode(stored.workoutPlan),
    inputMode: toMode(stored.inputMode),
    deviceSelector: toMode(stored.deviceSelector),
    mobileRideWidgets: toMode(stored.mobileRideWidgets),
    focusLeft: toMode(stored.focusLeft),
    focusRight: toMode(stored.focusRight),
    focusBottom: toMode(stored.focusBottom),
  };
}

export interface UsePanelStateReturn {
  /** Current panel state */
  state: PanelState;
  /** Desktop panel positions */
  positions: PanelPositions;
  /** Toggle a specific panel */
  toggle: (key: PanelKey) => void;
  /** Set a specific panel to expanded */
  expand: (key: PanelKey) => void;
  /** Set a specific panel to minimized */
  minimize: (key: PanelKey) => void;
  /** Set a specific panel mode */
  setMode: (key: PanelKey, mode: WidgetMode) => void;
  /** Set a specific panel to expanded, collapsing all others (accordion behavior) */
  expandOne: (key: PanelKey) => void;
  /** Set a specific panel to collapsed */
  collapse: (key: PanelKey) => void;
  /** Expand all panels */
  expandAll: () => void;
  /** Collapse all panels */
  collapseAll: () => void;
  /** Reset to device-appropriate defaults */
  reset: () => void;
  /** Apply explicit ride-start transitions */
  startRideLayout: () => void;
  /** Apply explicit ride-end transitions */
  endRideLayout: () => void;
  /** Set global mobile in-ride widget mode */
  setMobileRideWidgetsMode: (mode: WidgetMode) => void;
  /** Toggle global mobile in-ride widgets between expanded/minimized */
  toggleMobileRideWidgets: () => void;
  /** Update desktop panel position (in px; right/bottom support negatives) */
  setPanelPosition: (key: DesktopPanelKey, position: PanelPosition) => void;
  /** Snap panel to nearest screen edges */
  snapPanelToEdge: (key: DesktopPanelKey, viewport: { width: number; height: number }) => void;
  /** Reset layout modes and panel positions */
  resetLayout: () => void;
  /** Check if all panels are collapsed */
  isAllCollapsed: boolean;
  /** Check if all panels are expanded */
  isAllExpanded: boolean;
}

export function usePanelState(
  deviceType: 'mobile' | 'tablet' | 'desktop',
): UsePanelStateReturn {
  const preRideSnapshotRef = useRef<PanelState | null>(null);
  const preRidePositionsSnapshotRef = useRef<PanelPositions | null>(null);
  const rideLayoutActiveRef = useRef(false);
  // Guard to prevent re-entrant calls that could cause infinite re-renders
  const layoutTransitionInProgressRef = useRef(false);
  const [positions, setPositions] = useState<PanelPositions>(() => {
    const stored = loadStoredState();
    return stored?.positions ?? getDefaultPositions();
  });
  const [state, setState] = useState<PanelState>(() => {
    const stored = loadStoredState();
    if (stored) {
      return { ...getDefaultState(deviceType), ...stored.state };
    }
    return getDefaultState(deviceType);
  });

  useEffect(() => {
    saveStoredState({ state, positions });
  }, [state, positions]);

  const toggle = useCallback((key: PanelKey) => {
    setState((prev) => ({ ...prev, [key]: prev[key] === 'expanded' ? 'collapsed' : 'expanded' }));
  }, []);

  const expand = useCallback((key: PanelKey) => {
    setState((prev) => ({ ...prev, [key]: 'expanded' }));
  }, []);

  const minimize = useCallback((key: PanelKey) => {
    setState((prev) => ({ ...prev, [key]: 'minimized' }));
  }, []);

  const setMode = useCallback((key: PanelKey, mode: WidgetMode) => {
    setState((prev) => ({ ...prev, [key]: mode }));
  }, []);

  const expandOne = useCallback((key: PanelKey) => {
    // Accordion behavior: expand one panel, collapse all others
    const defaultState: PanelState = {
      workoutPlan: 'collapsed',
      inputMode: 'collapsed',
      deviceSelector: 'collapsed',
      mobileRideWidgets: 'minimized',
      focusLeft: 'collapsed',
      focusRight: 'collapsed',
      focusBottom: 'collapsed',
    };
    setState({ ...defaultState, [key]: 'expanded' });
  }, []);

  const collapse = useCallback((key: PanelKey) => {
    setState((prev) => ({ ...prev, [key]: 'collapsed' }));
  }, []);

  const expandAll = useCallback(() => {
    setState({
      workoutPlan: 'expanded',
      inputMode: 'expanded',
      deviceSelector: 'expanded',
      mobileRideWidgets: 'expanded',
      focusLeft: 'expanded',
      focusRight: 'expanded',
      focusBottom: 'expanded',
    });
  }, []);

  const collapseAll = useCallback(() => {
    setState({
      workoutPlan: 'collapsed',
      inputMode: 'collapsed',
      deviceSelector: 'collapsed',
      mobileRideWidgets: 'minimized',
      focusLeft: 'collapsed',
      focusRight: 'collapsed',
      focusBottom: 'collapsed',
    });
  }, []);

  const reset = useCallback(() => {
    setState(getDefaultState(deviceType));
  }, [deviceType]);

  const resetLayout = useCallback(() => {
    setState(getDefaultState(deviceType));
    setPositions(getDefaultPositions());
    rideLayoutActiveRef.current = false;
    preRideSnapshotRef.current = null;
    preRidePositionsSnapshotRef.current = null;
  }, [deviceType]);

  const startRideLayout = useCallback(() => {
    // Guard against re-entrant calls that could cause infinite re-renders
    if (layoutTransitionInProgressRef.current) return;
    layoutTransitionInProgressRef.current = true;
    
    setState((prev): PanelState => {
      if (!rideLayoutActiveRef.current) {
        preRideSnapshotRef.current = prev;
        preRidePositionsSnapshotRef.current = positions;
        rideLayoutActiveRef.current = true;
      }

      const nextMobileRideWidgets: WidgetMode = deviceType === 'mobile' ? 'minimized' : prev.mobileRideWidgets;
      const nextWorkoutPlan: WidgetMode = prev.workoutPlan === 'expanded' ? 'collapsed' : prev.workoutPlan;
      const nextInputMode: WidgetMode = prev.inputMode === 'expanded' ? 'collapsed' : prev.inputMode;
      const nextDeviceSelector: WidgetMode = prev.deviceSelector === 'expanded' ? 'collapsed' : prev.deviceSelector;

      if (
        prev.focusLeft === 'minimized' &&
        prev.focusRight === 'minimized' &&
        prev.focusBottom === 'minimized' &&
        prev.mobileRideWidgets === nextMobileRideWidgets &&
        prev.workoutPlan === nextWorkoutPlan &&
        prev.inputMode === nextInputMode &&
        prev.deviceSelector === nextDeviceSelector
      ) {
        layoutTransitionInProgressRef.current = false;
        return prev;
      }

      const result: PanelState = {
        ...prev,
        mobileRideWidgets: nextMobileRideWidgets,
        focusLeft: 'minimized',
        focusRight: 'minimized',
        focusBottom: 'minimized',
        workoutPlan: nextWorkoutPlan,
        inputMode: nextInputMode,
        deviceSelector: nextDeviceSelector,
      };
      
      // Schedule reset of the guard after React updates
      setTimeout(() => {
        layoutTransitionInProgressRef.current = false;
      }, 0);
      
      return result;
    });
  }, [deviceType, positions]);

  const endRideLayout = useCallback(() => {
    // Guard against re-entrant calls that could cause infinite re-renders
    if (layoutTransitionInProgressRef.current) return;
    layoutTransitionInProgressRef.current = true;
    
    if (!rideLayoutActiveRef.current && preRideSnapshotRef.current === null) {
      layoutTransitionInProgressRef.current = false;
      return;
    }
    const nextState = preRideSnapshotRef.current ?? getDefaultState(deviceType);
    const nextPositions = preRidePositionsSnapshotRef.current;
    rideLayoutActiveRef.current = false;
    preRideSnapshotRef.current = null;
    preRidePositionsSnapshotRef.current = null;
    setState(nextState);
    if (nextPositions) {
      setPositions(nextPositions);
    }
    // Reset the guard after React updates
    setTimeout((): void => {
      layoutTransitionInProgressRef.current = false;
    }, 0);
  }, [deviceType]);

  const setMobileRideWidgetsMode = useCallback((mode: WidgetMode) => {
    setState((prev) => ({ ...prev, mobileRideWidgets: mode }));
  }, []);

  const toggleMobileRideWidgets = useCallback(() => {
    setState((prev) => ({
      ...prev,
      mobileRideWidgets: prev.mobileRideWidgets === 'minimized' ? 'expanded' : 'minimized',
    }));
  }, []);

  const setPanelPosition = useCallback((key: DesktopPanelKey, position: PanelPosition) => {
    setPositions((prev) => ({ ...prev, [key]: position }));
  }, []);

  const snapPanelToEdge = useCallback((key: DesktopPanelKey, viewport: { width: number; height: number }) => {
    setPositions((prev) => {
      const current = prev[key];
      const next = { ...current };

      if (key === 'focusLeft' || key === 'focusRight') {
        const maxTop = viewport.height - PANEL_APPROX_SIZE.sideHeight - PANEL_EDGE_MARGIN;
        next.y = clamp(current.y, PANEL_EDGE_MARGIN, maxTop);

        const xFromLeft = current.x;
        const xFromRight = viewport.width + current.x;
        const nearLeft = xFromLeft <= PANEL_EDGE_MARGIN + PANEL_EDGE_SNAP_THRESHOLD;
        const nearRight = xFromRight <= PANEL_EDGE_MARGIN + PANEL_EDGE_SNAP_THRESHOLD;
        const snapLeft = nearLeft || (!nearRight && xFromLeft <= xFromRight);
        next.x = snapLeft ? PANEL_EDGE_MARGIN : -PANEL_EDGE_MARGIN;
      } else {
        const maxLeft = viewport.width - PANEL_APPROX_SIZE.bottomWidth - PANEL_EDGE_MARGIN;
        next.x = clamp(current.x, PANEL_EDGE_MARGIN, maxLeft);

        const yFromBottom = Math.abs(current.y);
        const yFromTop = viewport.height + current.y;
        const nearBottom = yFromBottom <= PANEL_EDGE_MARGIN + PANEL_EDGE_SNAP_THRESHOLD;
        const nearTop = yFromTop <= PANEL_EDGE_MARGIN + PANEL_EDGE_SNAP_THRESHOLD;
        const snapBottom = nearBottom || (!nearTop && yFromBottom <= yFromTop);
        next.y = snapBottom ? -PANEL_EDGE_MARGIN : PANEL_EDGE_MARGIN;
      }

      return { ...prev, [key]: next };
    });
  }, []);

  const isAllCollapsed = Object.values(state).every((v) => v === 'collapsed' || v === 'minimized');
  const isAllExpanded = Object.values(state).every((v) => v === 'expanded');

  return {
    state,
    positions,
    toggle,
    expand,
    minimize,
    setMode,
    expandOne,
    collapse,
    expandAll,
    collapseAll,
    reset,
    startRideLayout,
    endRideLayout,
    setMobileRideWidgetsMode,
    toggleMobileRideWidgets,
    setPanelPosition,
    snapPanelToEdge,
    resetLayout,
    isAllCollapsed,
    isAllExpanded,
  };
}
