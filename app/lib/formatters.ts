/**
 * Shared Formatting Utilities
 * 
 * Core Principles:
 * - DRY: Single source of truth for all formatting logic
 * - TESTABLE: Pure functions with predictable outputs
 * - TYPE-SAFE: Full TypeScript coverage
 */

/**
 * Format seconds into MM:SS or HH:MM:SS
 */
export function formatTime(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format milliseconds into MM:SS or HH:MM:SS
 */
export function formatDuration(ms: number): string {
  return formatTime(ms / 1000);
}

/**
 * Format a number as a percentage
 */
export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a number with commas as thousands separators
 */
export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format cryptocurrency amount (wei to ETH/token)
 */
export function formatTokenAmount(wei: bigint | string, decimals = 18, displayDecimals = 4): string {
  const value = typeof wei === "string" ? BigInt(wei) : wei;
  const divisor = BigInt(10 ** decimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  
  const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, displayDecimals);
  const wholeStr = whole.toString();
  
  // Remove trailing zeros from fraction
  const trimmedFraction = fractionStr.replace(/0+$/, "");
  
  if (trimmedFraction === "") {
    return wholeStr;
  }
  return `${wholeStr}.${trimmedFraction}`;
}

/**
 * Format date to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | number): string {
  const now = Date.now();
  const then = typeof date === "number" ? date : date.getTime();
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return new Date(then).toLocaleDateString();
}

/**
 * Format pace (minutes per km/mile)
 */
export function formatPace(seconds: number, unit: "km" | "mi" = "km"): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}/${unit}`;
}

/**
 * Format heart rate zone
 */
export function formatHeartRateZone(zone: number): string {
  const zones = ["Rest", "Recovery", "Endurance", "Tempo", "Threshold", "VO2 Max", "Anaerobic"];
  return zones[zone] || "Unknown";
}

/**
 * Format power zone
 */
export function formatPowerZone(zone: number): string {
  const zones = ["Active Recovery", "Endurance", "Tempo", "Sweet Spot", "Threshold", "VO2 Max", "Anaerobic", "Neuromuscular"];
  return zones[zone] || "Unknown";
}
