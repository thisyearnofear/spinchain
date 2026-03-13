/**
 * Haptic Feedback Hook
 * Provides tactile feedback for mobile interactions
 * MODULAR: Reusable hook with vibration pattern support
 */

"use client";

import { useCallback } from "react";

type HapticType = "light" | "medium" | "heavy" | "success" | "warning" | "error";

interface HapticPatterns {
  light: number[];
  medium: number[];
  heavy: number[];
  success: number[];
  warning: number[];
  error: number[];
}

const PATTERNS: HapticPatterns = {
  light: [10],
  medium: [20],
  heavy: [30],
  success: [0, 50, 100, 50],
  warning: [0, 100, 50, 100],
  error: [0, 200, 50, 200],
};

export function useHaptic() {
  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) {
      return false;
    }

    try {
      navigator.vibrate(pattern);
      return true;
    } catch {
      return false;
    }
  }, []);

  const trigger = useCallback((type: HapticType = "light") => {
    const pattern = PATTERNS[type];
    return vibrate(pattern);
  }, [vibrate]);

  const light = useCallback(() => trigger("light"), [trigger]);
  const medium = useCallback(() => trigger("medium"), [trigger]);
  const heavy = useCallback(() => trigger("heavy"), [trigger]);
  const success = useCallback(() => trigger("success"), [trigger]);
  const warning = useCallback(() => trigger("warning"), [trigger]);
  const error = useCallback(() => trigger("error"), [trigger]);

  // Check if haptic is supported
  const isSupported = typeof navigator !== "undefined" && "vibrate" in navigator;

  return {
    isSupported,
    trigger,
    light,
    medium,
    heavy,
    success,
    warning,
    error,
    vibrate,
  };
}
