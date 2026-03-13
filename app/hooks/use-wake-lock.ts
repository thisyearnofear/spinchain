/**
 * Wake Lock Hook
 * Prevents screen from sleeping during active riding sessions
 * MODULAR: Reusable hook for any component that needs wake lock
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface WakeLockState {
  isActive: boolean;
  request: () => Promise<void>;
  release: () => Promise<void>;
  error: string | null;
}

export function useWakeLock(): WakeLockState {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async () => {
    if (typeof document === "undefined" || !("wakeLock" in navigator)) {
      setError("Wake Lock not supported");
      return;
    }

    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      setIsActive(true);
      setError(null);

      wakeLockRef.current.addEventListener("release", () => {
        setIsActive(false);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to acquire wake lock";
      setError(message);
      setIsActive(false);
    }
  }, []);

  const release = useCallback(async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      setIsActive(false);
    }
  }, []);

  // Re-acquire wake lock on visibility change (e.g., switching tabs)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        await request();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      release();
    };
  }, [request, release]);

  return { isActive, request, release, error };
}
