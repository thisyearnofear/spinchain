// Platform Detection - Detect if running in native app or web browser

export type Platform = 'web' | 'ios' | 'android';

interface PlatformInfo {
  platform: Platform;
  isMobile: boolean;
  isNative: boolean;
  hasNativeBluetooth: boolean;
}

// Check if we're running in a Capacitor native app
function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  
  // @ts-expect-error - Capacitor global
  return window.Capacitor?.isNativePlatform?.() === true;
}

// Check if device is mobile (any platform)
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent || '';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
}

// Get current platform
export function getPlatformInfo(): PlatformInfo {
  // Server-side rendering
  if (typeof window === 'undefined') {
    return {
      platform: 'web',
      isMobile: false,
      isNative: false,
      hasNativeBluetooth: false,
    };
  }
  
  const isNative = isCapacitorNative();
  const isMobile = isMobileDevice();
  
  let platform: Platform = 'web';
  let hasNativeBluetooth = false;
  
  if (isNative) {
    // @ts-expect-error - Capacitor global
    const platformName = window.Capacitor?.getPlatform?.() || 'web';
    platform = platformName as Platform;
    hasNativeBluetooth = platformName === 'ios' || platformName === 'android';
  } else if (isMobile) {
    platform = 'web'; // Mobile browser
    // Web Bluetooth has limited support on mobile
    hasNativeBluetooth = typeof navigator.bluetooth !== 'undefined';
  }
  
  return {
    platform,
    isMobile,
    isNative,
    hasNativeBluetooth,
  };
}

// Convenience function
export const isNativeApp = (): boolean => getPlatformInfo().isNative;
export const isMobile = (): boolean => getPlatformInfo().isMobile;
export const hasNativeBluetooth = (): boolean => getPlatformInfo().hasNativeBluetooth;
