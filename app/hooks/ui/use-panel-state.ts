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

const STORAGE_KEY = 'spinchain:ride:panelState';

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

function loadStoredState(): Partial<PanelState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return migrateStoredState(JSON.parse(stored));
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveStoredState(state: PanelState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  /** Check if all panels are collapsed */
  isAllCollapsed: boolean;
  /** Check if all panels are expanded */
  isAllExpanded: boolean;
}

export function usePanelState(
  deviceType: 'mobile' | 'tablet' | 'desktop',
): UsePanelStateReturn {
  const preRideSnapshotRef = useRef<PanelState | null>(null);
  const rideLayoutActiveRef = useRef(false);
  const [state, setState] = useState<PanelState>(() => {
    // Try to load from localStorage first
    const stored = loadStoredState();
    if (stored) {
      // Merge with defaults to handle new panels added in future versions
      return { ...getDefaultState(deviceType), ...stored };
    }
    return getDefaultState(deviceType);
  });

  // Save to localStorage on state change
  useEffect(() => {
    saveStoredState(state);
  }, [state]);

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

  const startRideLayout = useCallback(() => {
    setState((prev) => {
      if (!rideLayoutActiveRef.current) {
        preRideSnapshotRef.current = prev;
        rideLayoutActiveRef.current = true;
      }

      return {
        ...prev,
        mobileRideWidgets: deviceType === 'mobile' ? 'minimized' : prev.mobileRideWidgets,
        focusLeft: 'minimized',
        focusRight: 'minimized',
        focusBottom: 'minimized',
        workoutPlan: prev.workoutPlan === 'expanded' ? 'collapsed' : prev.workoutPlan,
        inputMode: prev.inputMode === 'expanded' ? 'collapsed' : prev.inputMode,
        deviceSelector: prev.deviceSelector === 'expanded' ? 'collapsed' : prev.deviceSelector,
      };
    });
  }, [deviceType]);

  const endRideLayout = useCallback(() => {
    setState(preRideSnapshotRef.current ?? getDefaultState(deviceType));
    rideLayoutActiveRef.current = false;
    preRideSnapshotRef.current = null;
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

  const isAllCollapsed = Object.values(state).every((v) => v === 'collapsed' || v === 'minimized');
  const isAllExpanded = Object.values(state).every((v) => v === 'expanded');

  return {
    state,
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
    isAllCollapsed,
    isAllExpanded,
  };
}
