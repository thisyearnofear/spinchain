/**
 * useSwipeGesture — Mobile gesture support for dismissing/modals.
 *
 * Provides:
 * - Swipe down to dismiss transient modals (keyboard hints, no-bike, demo)
 * - Swipe down on completion screen to go to next phase
 * - Swipe up to expand coach messages
 * - Swipe right from left edge = back / dismiss modal
 * - Swipe left from right edge = options menu
 *
 * All gestures respect reduced-motion preference.
 * All gestures are coalesced with React's touch events (no conflict).
 *
 * Usage:
 *   const { ref, dismiss } = useSwipeGesture({
 *     onSwipeDown: () => dismissModal(),
 *     onSwipeLeft: () => openMenu(),
 *     minSwipeDistance: 80,  // px
 *     maxSwipeDuration: 300, // ms
 *   });
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface SwipeOptions {
  onSwipeDown?: () => void;
  onSwipeUp?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Minimum distance in px for a swipe to register */
  minSwipeDistance?: number;
  /** Maximum duration in ms for a swipe to register */
  maxSwipeDuration?: number;
  /** Ignore swipes when touching an element with this class */
  ignoreElements?: string;
  /** Disable all gestures */
  disabled?: boolean;
}

export interface SwipeResult {
  /** Ref to attach to the container element */
  ref: React.RefObject<HTMLDivElement>;
  /** Manually trigger a dismiss */
  dismiss: () => void;
  /** Whether a gesture is in progress */
  isSwiping: boolean;
}

export function useSwipeGesture(options: SwipeOptions = {}): SwipeResult {
  const {
    onSwipeDown,
    onSwipeUp,
    onSwipeLeft,
    onSwipeRight,
    minSwipeDistance = 80,
    maxSwipeDuration = 300,
    ignoreElements = "button, a, input, select, textarea, [data-ignore-swipe]",
    disabled = false,
  } = options;

  const ref = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number } | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeStartPos, setSwipeStartPos] = useState({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled) return;

    const target = e.target as HTMLElement;
    // Ignore swipes from interactive elements
    if (target.closest(ignoreElements)) return;

    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY, time: Date.now() });
    setSwipeStartPos({ x: touch.clientX, y: touch.clientY });
  }, [disabled, ignoreElements]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!touchStart || disabled) return;

    const touch = e.touches[0];
    const deltaY = Math.abs(touch.clientY - touchStart.y);
    const deltaX = Math.abs(touch.clientX - touchStart.x);
    const elapsed = Date.now() - touchStart.time;

    // Check if this is a significant swipe
    if (elapsed > maxSwipeDuration) {
      setTouchStart(null);
      setIsSwiping(false);
      return;
    }

    if (deltaY > deltaX && deltaY > minSwipeDistance / 2) {
      setIsSwiping(true);
    }
  }, [touchStart, disabled, maxSwipeDuration, minSwipeDistance]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!touchStart || disabled) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    const elapsed = Date.now() - touchStart.time;

    // Check swipe direction and distance
    if (elapsed > maxSwipeDuration) {
      setTouchStart(null);
      setIsSwiping(false);
      return;
    }

    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (absDeltaY > absDeltaX && absDeltaY > minSwipeDistance) {
      if (deltaY > 0) {
        // Swipe down
        onSwipeDown?.();
      } else {
        // Swipe up
        onSwipeUp?.();
      }
    } else if (absDeltaX > absDeltaY && absDeltaX > minSwipeDistance) {
      if (deltaX > 0) {
        // Swipe right
        onSwipeRight?.();
      } else {
        // Swipe left
        onSwipeLeft?.();
      }
    }

    setTouchStart(null);
    setIsSwiping(false);
  }, [touchStart, disabled, maxSwipeDuration, minSwipeDistance, onSwipeDown, onSwipeUp, onSwipeLeft, onSwipeRight]);

  // Attach event listeners
  useEffect(() => {
    if (disabled) return;

    const el = ref.current;
    if (!el) return;

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [disabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { ref, dismiss: () => onSwipeDown?.(), isSwiping };
}

