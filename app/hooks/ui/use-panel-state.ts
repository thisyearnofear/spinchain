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

import { useState, useCallback, useEffect } from 'react';

export interface PanelState {
  // Pre-ride setup panels
  workoutPlan: boolean;
  inputMode: boolean;
  deviceSelector: boolean;
  // Focus View panels
  focusLeft: boolean;
  focusRight: boolean;
  focusBottom: boolean;
}

export type PanelKey = keyof PanelState;

const STORAGE_KEY = 'spinchain:ride:panelState';

// Default states based on device type
function getDefaultState(deviceType: 'mobile' | 'tablet' | 'desktop'): PanelState {
  const allExpanded: PanelState = {
    workoutPlan: true,
    inputMode: true,
    deviceSelector: true,
    focusLeft: true,
    focusRight: true,
    focusBottom: true,
  };

  const allCollapsed: PanelState = {
    workoutPlan: false,
    inputMode: false,
    deviceSelector: false,
    focusLeft: false,
    focusRight: false,
    focusBottom: false,
  };

  // Mobile: collapse by default (limited screen space)
  // Desktop: expand by default
  // Tablet: expand in landscape, collapse in portrait (handled by orientation check in component)
  if (deviceType === 'mobile') {
    // On mobile, keep essential panels expanded
    return {
      ...allCollapsed,
      workoutPlan: true, // Keep workout selector visible
      inputMode: true,   // Keep input mode visible
    };
  }

  return allExpanded;
}

function loadStoredState(): Partial<PanelState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
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

export interface UsePanelStateReturn {
  /** Current panel state (true = expanded, false = collapsed) */
  state: PanelState;
  /** Toggle a specific panel */
  toggle: (key: PanelKey) => void;
  /** Set a specific panel to expanded */
  expand: (key: PanelKey) => void;
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
  /** Collapse ride overlays while keeping setup panels available */
  collapseRidePanels: () => void;
  /** Check if all panels are collapsed */
  isAllCollapsed: boolean;
  /** Check if all panels are expanded */
  isAllExpanded: boolean;
}

export function usePanelState(
  deviceType: 'mobile' | 'tablet' | 'desktop',
): UsePanelStateReturn {
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
    setState((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const expand = useCallback((key: PanelKey) => {
    setState((prev) => ({ ...prev, [key]: true }));
  }, []);

  const expandOne = useCallback((key: PanelKey) => {
    // Accordion behavior: expand one panel, collapse all others
    const defaultState: PanelState = {
      workoutPlan: false,
      inputMode: false,
      deviceSelector: false,
      focusLeft: false,
      focusRight: false,
      focusBottom: false,
    };
    setState({ ...defaultState, [key]: true });
  }, []);

  const collapse = useCallback((key: PanelKey) => {
    setState((prev) => ({ ...prev, [key]: false }));
  }, []);

  const expandAll = useCallback(() => {
    setState({
      workoutPlan: true,
      inputMode: true,
      deviceSelector: true,
      focusLeft: true,
      focusRight: true,
      focusBottom: true,
    });
  }, []);

  const collapseAll = useCallback(() => {
    setState({
      workoutPlan: false,
      inputMode: false,
      deviceSelector: false,
      focusLeft: false,
      focusRight: false,
      focusBottom: false,
    });
  }, []);

  const reset = useCallback(() => {
    setState(getDefaultState(deviceType));
  }, [deviceType]);

  const collapseRidePanels = useCallback(() => {
    setState((prev) => ({
      ...prev,
      focusLeft: false,
      focusRight: false,
      focusBottom: false,
    }));
  }, []);

  const isAllCollapsed = Object.values(state).every((v) => v === false);
  const isAllExpanded = Object.values(state).every((v) => v === true);

  return {
    state,
    toggle,
    expand,
    expandOne,
    collapse,
    expandAll,
    collapseAll,
    reset,
    collapseRidePanels,
    isAllCollapsed,
    isAllExpanded,
  };
}
