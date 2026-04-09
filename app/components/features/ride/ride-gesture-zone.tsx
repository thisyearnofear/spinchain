"use client";

import { useRef, useEffect, ReactNode, useState } from "react";
import { motion } from "framer-motion";
import { useRideFocusGestures } from "@/app/hooks/ui/use-ride-focus-mode";

/**
 * Mobile gesture zones for progressive disclosure (Priority 3)
 * 
 * - Swipe up from bottom: Reveal more panels
 * - Swipe down from top: Hide panels
 * - Long-press 3D scene: Instant zen mode toggle
 */

interface RideGestureZoneProps {
  children: ReactNode;
  enabled?: boolean;
  onHaptic?: (type?: "light" | "medium" | "heavy") => void;
}

export function RideGestureZone({ children, enabled = true, onHaptic }: RideGestureZoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { onSwipeUp, onSwipeDown, onLongPress } = useRideFocusGestures();
  
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!enabled || !containerRef.current) return;
    
    const container = containerRef.current;
    
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      
      // Start long-press timer
      longPressTimerRef.current = setTimeout(() => {
        onHaptic?.("medium");
        onLongPress();
        touchStartRef.current = null; // Cancel swipe detection
      }, 800); // 800ms for long press
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      // Cancel long-press if finger moves
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      // Cancel long-press timer
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      
      if (!touchStartRef.current) return;
      
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const deltaTime = Date.now() - touchStartRef.current.time;
      
      // Detect swipe (minimum 50px, max 500ms)
      const isSwipe = Math.abs(deltaY) > 50 && deltaTime < 500;
      const isVertical = Math.abs(deltaY) > Math.abs(deltaX) * 2; // Mostly vertical
      
      if (isSwipe && isVertical) {
        if (deltaY < 0) {
          // Swipe up
          onHaptic?.("light");
          onSwipeUp();
        } else {
          // Swipe down
          onHaptic?.("light");
          onSwipeDown();
        }
      }
      
      touchStartRef.current = null;
    };
    
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    
    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, [enabled, onSwipeUp, onSwipeDown, onLongPress, onHaptic]);
  
  return (
    <div ref={containerRef} className="relative w-full h-full">
      {children}
      
      {/* Visual hint for gestures (fades after first use) */}
      {enabled && (
        <GestureHints />
      )}
    </div>
  );
}

function GestureHints() {
  const [showHints, setShowHints] = useState(true);
  
  useEffect(() => {
    const hasSeenHints = localStorage.getItem("ride-gesture-hints-seen");
    if (hasSeenHints) {
      setShowHints(false);
    } else {
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setShowHints(false);
        localStorage.setItem("ride-gesture-hints-seen", "true");
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, []);
  
  if (!showHints) return null;
  
  return (
    <motion.div
      className="absolute inset-x-0 bottom-32 flex flex-col items-center gap-2 pointer-events-none z-30"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
    >
      <div className="bg-black/60 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 text-xs text-white/80">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          <span>Swipe up/down to adjust view</span>
        </div>
      </div>
      <div className="bg-black/60 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 text-xs text-white/80">
        <span>Long-press for zen mode</span>
      </div>
    </motion.div>
  );
}