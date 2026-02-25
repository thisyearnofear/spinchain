/**
 * Utility Functions
 * 
 * Core Principles:
 * - DRY: Shared utilities used across the app
 * - TYPE-SAFE: Full TypeScript coverage
 * - TESTABLE: Pure functions with predictable outputs
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with proper precedence
 * Uses clsx for conditional classes and tailwind-merge for deduplication
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sleep utility for async delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random ID
 */
export function generateId(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Check if code is running on client side
 */
export function isClient(): boolean {
  return typeof window !== "undefined";
}

/**
 * Check if code is running on server side
 */
export function isServer(): boolean {
  return typeof window === "undefined";
}

/**
 * Safely access localStorage
 */
export function getLocalStorage(key: string): string | null {
  if (!isClient()) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safely set localStorage
 */
export function setLocalStorage(key: string, value: string): boolean {
  if (!isClient()) return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely remove from localStorage
 */
export function removeLocalStorage(key: string): boolean {
  if (!isClient()) return false;
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
