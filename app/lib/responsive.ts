/**
 * Responsive Utilities
 * Mobile-first breakpoint system and device detection
 * ORGANIZED: Single source of truth for responsive logic
 */

"use client";

import { useState, useEffect } from "react";

/**
 * Breakpoints following Tailwind's mobile-first approach
 */
export const BREAKPOINTS = {
  sm: 640,   // Small devices (phones)
  md: 768,   // Medium devices (tablets)
  lg: 1024,  // Large devices (laptops)
  xl: 1280,  // Extra large (desktops)
  "2xl": 1536, // 2X Extra large (large desktops)
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Device type detection
 */
export type DeviceType = "mobile" | "tablet" | "desktop";

export function getDeviceType(width: number): DeviceType {
  if (width < BREAKPOINTS.md) return "mobile";
  if (width < BREAKPOINTS.lg) return "tablet";
  return "desktop";
}

/**
 * Hook: Get current device type
 */
export function useDeviceType(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => {
    if (typeof window === "undefined") return "desktop";
    return getDeviceType(window.innerWidth);
  });

  useEffect(() => {
    const handleResize = () => {
      setDeviceType(getDeviceType(window.innerWidth));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return deviceType;
}

/**
 * Hook: Check if viewport is at least a certain breakpoint
 */
export function useMediaQuery(breakpoint: Breakpoint): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= BREAKPOINTS[breakpoint];
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${BREAKPOINTS[breakpoint]}px)`);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [breakpoint]);

  return matches;
}

/**
 * Hook: Get current viewport dimensions
 */
export function useViewport() {
  const [viewport, setViewport] = useState(() => {
    if (typeof window === "undefined") {
      return { width: 1024, height: 768 };
    }
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  });

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return viewport;
}

/**
 * Hook: Detect touch device
 */
export function useTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch(
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0
    );
  }, []);

  return isTouch;
}

/**
 * Hook: Detect device orientation
 */
export type Orientation = "portrait" | "landscape";

export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>(() => {
    if (typeof window === "undefined") return "portrait";
    return window.innerHeight > window.innerWidth ? "portrait" : "landscape";
  });

  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientation(
        window.innerHeight > window.innerWidth ? "portrait" : "landscape"
      );
    };

    window.addEventListener("resize", handleOrientationChange);
    window.addEventListener("orientationchange", handleOrientationChange);
    
    return () => {
      window.removeEventListener("resize", handleOrientationChange);
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
  }, []);

  return orientation;
}

/**
 * Responsive class builder
 * Generates Tailwind classes based on device type
 */
export function responsiveClass(
  base: string,
  mobile?: string,
  tablet?: string,
  desktop?: string
): string {
  const classes = [base];
  
  if (mobile) classes.push(`max-md:${mobile}`);
  if (tablet) classes.push(`md:${tablet} max-lg:${tablet}`);
  if (desktop) classes.push(`lg:${desktop}`);
  
  return classes.join(" ");
}

/**
 * Touch-friendly class builder
 * Adds larger touch targets on mobile
 */
export function touchClass(base: string): string {
  return `${base} touch-manipulation active:scale-95 transition-transform`;
}

/**
 * Safe area insets (for notched devices)
 */
export function useSafeAreaInsets() {
  const [insets, setInsets] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const style = getComputedStyle(document.documentElement);
    
    setInsets({
      top: parseInt(style.getPropertyValue("env(safe-area-inset-top)") || "0"),
      right: parseInt(style.getPropertyValue("env(safe-area-inset-right)") || "0"),
      bottom: parseInt(style.getPropertyValue("env(safe-area-inset-bottom)") || "0"),
      left: parseInt(style.getPropertyValue("env(safe-area-inset-left)") || "0"),
    });
  }, []);

  return insets;
}

/**
 * Viewport height that accounts for mobile browser chrome
 */
export function useActualViewportHeight(): number {
  const [height, setHeight] = useState(() => {
    if (typeof window === "undefined") return 768;
    return window.visualViewport?.height || window.innerHeight;
  });

  useEffect(() => {
    const handleResize = () => {
      setHeight(window.visualViewport?.height || window.innerHeight);
    };

    window.visualViewport?.addEventListener("resize", handleResize);
    window.addEventListener("resize", handleResize);
    
    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return height;
}
