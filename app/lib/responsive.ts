/**
 * Responsive Utilities
 * Mobile-first breakpoint system and device detection
 * ORGANIZED: Single source of truth for responsive logic
 */

"use client";

import { useState, useEffect, useMemo } from "react";

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
      // Use a microtask to defer the state update
      Promise.resolve().then(() => {
        setMatches(e.matches);
      });
    };

    // Use a microtask to defer the state update
    Promise.resolve().then(() => {
      setMatches(mediaQuery.matches);
    });
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
    // Use a microtask to defer the state update
    Promise.resolve().then(() => {
      setIsTouch(
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0
      );
    });
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

    // Use a microtask to defer the state update
    Promise.resolve().then(() => {
      setInsets({
        top: parseInt(style.getPropertyValue("env(safe-area-inset-top)") || "0"),
        right: parseInt(style.getPropertyValue("env(safe-area-inset-right)") || "0"),
        bottom: parseInt(style.getPropertyValue("env(safe-area-inset-bottom)") || "0"),
        left: parseInt(style.getPropertyValue("env(safe-area-inset-left)") || "0"),
      });
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

/**
 * Performance tier detection for adaptive rendering
 */
export type PerformanceTier = "high" | "medium" | "low";

export function usePerformanceTier(): PerformanceTier {
  const [tier, setTier] = useState<PerformanceTier>("medium");
  const deviceType = useDeviceType();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check hardware concurrency (CPU cores)
    const cores = navigator.hardwareConcurrency || 4;
    
    // Check device memory (if available)
    const memory = (navigator as any).deviceMemory || 4;
    
    // Check GPU tier via WebGL
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
    let gpuTier: "high" | "medium" | "low" = "medium";
    
    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string;
        // Simple heuristic: check for high-end GPU keywords
        if (/Apple GPU|Mali-G|Adreno 6|RTX|GTX|Radeon/i.test(renderer)) {
          gpuTier = "high";
        } else if (/Adreno 5|Mali-T|Intel HD/i.test(renderer)) {
          gpuTier = "low";
        }
      }
    }

    // Determine tier based on device type and hardware
    if (deviceType === "mobile") {
      // Mobile: conservative by default
      if (cores >= 8 && memory >= 6 && gpuTier === "high") {
        setTier("high");
      } else if (cores >= 4 && memory >= 4) {
        setTier("medium");
      } else {
        setTier("low");
      }
    } else if (deviceType === "tablet") {
      // Tablet: medium by default
      if (cores >= 6 && memory >= 4 && gpuTier === "high") {
        setTier("high");
      } else {
        setTier("medium");
      }
    } else {
      // Desktop: high by default
      if (cores >= 4 && memory >= 8) {
        setTier("high");
      } else {
        setTier("medium");
      }
    }
  }, [deviceType]);

  return tier;
}

/**
 * Network quality detection
 */
export type NetworkQuality = "4g" | "3g" | "2g" | "slow-2g" | "offline";

export function useNetworkQuality(): NetworkQuality {
  const [quality, setQuality] = useState<NetworkQuality>("4g");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    if (!connection) return;

    const updateQuality = () => {
      const effectiveType = connection.effectiveType || "4g";
      setQuality(effectiveType);
    };

    updateQuality();
    connection.addEventListener("change", updateQuality);
    
    return () => connection.removeEventListener("change", updateQuality);
  }, []);

  return quality;
}

/**
 * Battery status detection (for power-saving mode)
 */
export function useBatteryStatus() {
  const [battery, setBattery] = useState({
    level: 1,
    charging: true,
    lowPower: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateBattery = (batteryManager: any) => {
      setBattery({
        level: batteryManager.level,
        charging: batteryManager.charging,
        lowPower: batteryManager.level < 0.2 && !batteryManager.charging,
      });
    };

    (navigator as any).getBattery?.().then((batteryManager: any) => {
      updateBattery(batteryManager);
      
      batteryManager.addEventListener("levelchange", () => updateBattery(batteryManager));
      batteryManager.addEventListener("chargingchange", () => updateBattery(batteryManager));
    });
  }, []);

  return battery;
}

/**
 * Adaptive quality settings based on device capabilities
 */
export function useAdaptiveQuality() {
  const performanceTier = usePerformanceTier();
  const networkQuality = useNetworkQuality();
  const battery = useBatteryStatus();
  const deviceType = useDeviceType();

  return useMemo(() => {
    // Start with tier-based defaults
    let quality = {
      // 3D rendering
      pixelRatio: 1,
      shadows: false,
      antialiasing: false,
      particleCount: 100,
      meshDetail: "low" as "low" | "medium" | "high",
      
      // Assets
      textureQuality: "medium" as "low" | "medium" | "high",
      modelLOD: 2,
      
      // Animation
      fps: 30,
      enableBloom: false,
      enableSSAO: false,
    };

    // Adjust based on performance tier
    if (performanceTier === "high") {
      quality = {
        ...quality,
        pixelRatio: Math.min(window.devicePixelRatio, 2),
        shadows: true,
        antialiasing: true,
        particleCount: 500,
        meshDetail: "high",
        textureQuality: "high",
        modelLOD: 0,
        fps: 60,
        enableBloom: true,
        enableSSAO: deviceType === "desktop",
      };
    } else if (performanceTier === "medium") {
      quality = {
        ...quality,
        pixelRatio: 1,
        shadows: deviceType !== "mobile",
        antialiasing: deviceType !== "mobile",
        particleCount: 200,
        meshDetail: "medium",
        textureQuality: "medium",
        modelLOD: 1,
        fps: 45,
      };
    }

    // Reduce quality on slow network
    if (networkQuality === "2g" || networkQuality === "slow-2g") {
      quality.textureQuality = "low";
      quality.particleCount = Math.floor(quality.particleCount / 2);
    }

    // Power saving mode
    if (battery.lowPower) {
      quality.fps = 30;
      quality.shadows = false;
      quality.enableBloom = false;
      quality.enableSSAO = false;
      quality.particleCount = Math.floor(quality.particleCount / 2);
    }

    return quality;
  }, [performanceTier, networkQuality, battery, deviceType]);
}
