/**
 * Fullscreen Hook
 * Enables immersive fullscreen mode for mobile riding experience
 * MODULAR: Reusable hook for fullscreen toggling
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface FullscreenState {
  isActive: boolean;
  request: (element?: Element) => Promise<void>;
  exit: () => Promise<void>;
  toggle: (element?: Element) => Promise<void>;
  error: string | null;
}

export function useFullscreen(targetRef?: React.RefObject<Element>): FullscreenState {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getElement = useCallback((): Element | null => {
    if (targetRef?.current) return targetRef.current;
    if (typeof document !== "undefined") return document.documentElement;
    return null;
  }, [targetRef]);

  const request = useCallback(async (element?: Element) => {
    if (typeof document === "undefined") return;

    const target = element || getElement();
    if (!target) {
      setError("No element to make fullscreen");
      return;
    }

    try {
      await target.requestFullscreen();
      setIsActive(true);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to enter fullscreen";
      setError(message);
    }
  }, [getElement]);

  const exit = useCallback(async () => {
    if (typeof document === "undefined") return;

    try {
      await document.exitFullscreen();
      setIsActive(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to exit fullscreen";
      setError(message);
    }
  }, []);

  const toggle = useCallback(async (element?: Element) => {
    if (isActive) {
      await exit();
    } else {
      await request(element);
    }
  }, [isActive, request, exit]);

  // Listen for fullscreen changes
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleChange = () => {
      setIsActive(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  return { isActive, request, exit, toggle, error };
}
