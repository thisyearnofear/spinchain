/**
 * Haptic Feedback Hook
 * Provides tactile feedback for mobile interactions
 * MODULAR: Reusable hook with vibration pattern support
 */

"use client";

import { useCallback } from "react";

export type HapticType = "light" | "medium" | "heavy" | "success" | "warning" | "error";

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

/** Standalone haptic trigger for use outside React components (e.g. in queue
 *  callbacks). Mirrors useHaptic's trigger().
 *
 *  navigator.vibrate never fires in iOS WKWebView, so inside the Capacitor
 *  shell we go through @capacitor/haptics (dynamic import: the web bundle
 *  only pays a dead branch). Vibration API stays the web fallback. */
function isNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor?.isNativePlatform?.(),
  );
}

let capHapticsPromise: Promise<typeof import("@capacitor/haptics") | null> | null = null;
function loadCapHaptics() {
  if (!capHapticsPromise) {
    capHapticsPromise = import("@capacitor/haptics").catch(() => null);
  }
  return capHapticsPromise;
}

function nativeHaptic(type: HapticType): void {
  void loadCapHaptics().then((mod) => {
    if (!mod) return;
    const { Haptics, ImpactStyle, NotificationType } = mod;
    switch (type) {
      case "light":
        void Haptics.impact({ style: ImpactStyle.Light });
        break;
      case "medium":
        void Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case "heavy":
        void Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case "success":
        void Haptics.notification({ type: NotificationType.Success });
        break;
      case "warning":
        void Haptics.notification({ type: NotificationType.Warning });
        break;
      case "error":
        void Haptics.notification({ type: NotificationType.Error });
        break;
    }
  });
}

export function haptic(type: HapticType = "light"): boolean {
  if (isNativeShell()) {
    nativeHaptic(type);
    return true;
  }
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) {
    return false;
  }
  try {
    navigator.vibrate(PATTERNS[type]);
    return true;
  } catch {
    return false;
  }
}

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
    // Route through the standalone entry so the Capacitor shell gets native
    // haptics; vibrate() stays for raw patterns (web only).
    return haptic(type);
  }, []);

  const light = useCallback(() => trigger("light"), [trigger]);
  const medium = useCallback(() => trigger("medium"), [trigger]);
  const heavy = useCallback(() => trigger("heavy"), [trigger]);
  const success = useCallback(() => trigger("success"), [trigger]);
  const warning = useCallback(() => trigger("warning"), [trigger]);
  const error = useCallback(() => trigger("error"), [trigger]);

  // Check if haptic is supported (Vibration API on web, Capacitor in the app)
  const isSupported =
    (typeof navigator !== "undefined" && "vibrate" in navigator) || isNativeShell();

  const rhythm = useCallback((bpm: number, durationMs: number = 2000) => {
    if (!isSupported) return;
    const intervalMs = (60 / bpm) * 1000;
    const pulseCount = Math.floor(durationMs / intervalMs);
    const pattern = Array(pulseCount).fill([10, intervalMs - 10]).flat();
    return vibrate(pattern);
  }, [isSupported, vibrate]);

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
    rhythm,
  };
}
