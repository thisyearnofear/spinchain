"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRideFocusMode, FOCUS_MODE_META, type RideFocusMode } from "@/app/hooks/ui/use-ride-focus-mode";
import { useState, useRef, useEffect } from "react";

/**
 * Unified Ride Focus Control - replaces the fragmented FAB + HUD mode buttons
 * 
 * Desktop: Click to cycle, long-press for menu, keyboard shortcuts
 * Mobile: Tap to cycle, long-press for menu, swipe gestures
 */

interface RideFocusControlProps {
  position?: "bottom-right" | "top-right";
  size?: "sm" | "md" | "lg";
  enableGestures?: boolean; // Mobile gesture zones
  onHaptic?: (type?: "light" | "medium" | "heavy") => void;
}

export function RideFocusControl({ 
  position = "bottom-right", 
  size = "md",
  enableGestures = true,
  onHaptic,
}: RideFocusControlProps) {
  const { mode, cycleMode } = useRideFocusMode();
  const [showMenu, setShowMenu] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [quickPeek, setQuickPeek] = useState(false);
  const quickPeekTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const meta = FOCUS_MODE_META[mode];
  
  const sizeClasses = {
    sm: "w-12 h-12 text-lg",
    md: "w-14 h-14 text-xl",
    lg: "w-16 h-16 text-2xl",
  };
  
  const positionClasses = {
    "bottom-right": "bottom-6 right-6",
    "top-right": "top-6 right-6",
  };
  
  const handlePressStart = () => {
    const timer = setTimeout(() => {
      onHaptic?.("medium");
      setShowMenu(true);
    }, 500); // Long press = 500ms
    setLongPressTimer(timer);
  };
  
  const handlePressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    // If menu wasn't shown, it was a quick tap - cycle mode
    if (!showMenu) {
      onHaptic?.("light");
      cycleMode();
    }
  };
  
  const handleModeSelect = (selectedMode: RideFocusMode) => {
    onHaptic?.("medium");
    useRideFocusMode.getState().setMode(selectedMode);
    setShowMenu(false);
  };
  
  // Quick peek on Tab key (Priority 5)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab" && document.body.classList.contains("ride-active")) {
        e.preventDefault();
        setQuickPeek(true);
        
        // Auto-hide after 3 seconds
        if (quickPeekTimerRef.current) {
          clearTimeout(quickPeekTimerRef.current);
        }
        quickPeekTimerRef.current = setTimeout(() => {
          setQuickPeek(false);
        }, 3000);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (quickPeekTimerRef.current) {
        clearTimeout(quickPeekTimerRef.current);
      }
    };
  }, []);
  
  return (
    <>
      {/* Main control button */}
      <motion.button
        className={`fixed ${positionClasses[position]} ${sizeClasses[size]} rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg hover:bg-black/70 transition-colors z-50`}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title={`${meta.label} mode - Click to cycle, hold for menu`}
      >
        <span className={meta.color}>{meta.icon}</span>
      </motion.button>
      
      {/* Quick peek indicator (Tab key) */}
      <AnimatePresence>
        {quickPeek && (
          <motion.div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <div className="bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl px-6 py-4 shadow-2xl">
              <div className="text-center">
                <div className="text-4xl mb-2">{meta.icon}</div>
                <div className={`text-lg font-bold ${meta.color}`}>{meta.label} Mode</div>
                <div className="text-xs text-white/60 mt-1">{meta.description}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Radial menu (shown on long press) */}
      <AnimatePresence>
        {showMenu && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMenu(false)}
            />
            
            {/* Menu items */}
            <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
              <div className="relative w-64 h-64 pointer-events-auto">
                {(Object.keys(FOCUS_MODE_META) as RideFocusMode[]).map((modeKey, index) => {
                  const modeMeta = FOCUS_MODE_META[modeKey];
                  const angle = (index * 90 - 45) * (Math.PI / 180); // Spread in circle
                  const radius = 80;
                  const x = Math.cos(angle) * radius;
                  const y = Math.sin(angle) * radius;
                  
                  return (
                    <motion.button
                      key={modeKey}
                      className={`absolute top-1/2 left-1/2 w-20 h-20 rounded-full flex flex-col items-center justify-center gap-1 ${
                        mode === modeKey
                          ? "bg-white/20 border-2 border-white/60"
                          : "bg-black/60 border border-white/20"
                      } backdrop-blur-md shadow-xl hover:bg-white/30 transition-colors`}
                      style={{
                        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                      }}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleModeSelect(modeKey)}
                    >
                      <span className={`text-2xl ${modeMeta.color}`}>{modeMeta.icon}</span>
                      <span className="text-xs text-white/80 font-medium">{modeMeta.label}</span>
                      <kbd className="text-[8px] text-white/40 font-mono">{index + 1}</kbd>
                    </motion.button>
                  );
                })}
                
                {/* Center label */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                  <div className="text-sm text-white/60 font-medium">Select Mode</div>
                  <div className="text-xs text-white/40 mt-1">or press 1-4</div>
                </div>
              </div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Compact mode indicator (shows current mode in top bar)
 */
export function RideFocusModeIndicator() {
  const mode = useRideFocusMode((state) => state.mode);
  const meta = FOCUS_MODE_META[mode];
  
  return (
    <motion.div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      title={meta.description}
    >
      <span className={meta.color}>{meta.icon}</span>
      <span className="text-xs text-white/80 font-medium">{meta.label}</span>
    </motion.div>
  );
}

/**
 * Keyboard shortcut hint overlay (shows on first ride)
 */
export function RideFocusKeyboardHints({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      className="fixed bottom-24 right-6 max-w-xs bg-black/80 backdrop-blur-md border border-white/20 rounded-lg p-4 shadow-2xl z-50"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Keyboard Shortcuts</h3>
        <button
          onClick={onDismiss}
          className="text-white/60 hover:text-white text-xs"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-2 text-xs text-white/80">
        <div className="flex justify-between gap-4">
          <kbd className="px-2 py-1 bg-white/10 rounded">Z</kbd>
          <span>Toggle Zen mode</span>
        </div>
        <div className="flex justify-between gap-4">
          <kbd className="px-2 py-1 bg-white/10 rounded">H</kbd>
          <span>Cycle focus modes</span>
        </div>
        <div className="flex justify-between gap-4">
          <kbd className="px-2 py-1 bg-white/10 rounded">I</kbd>
          <span>Toggle interval banner</span>
        </div>
        <div className="flex justify-between gap-4">
          <kbd className="px-2 py-1 bg-white/10 rounded">A</kbd>
          <span>Toggle AI coach</span>
        </div>
        <div className="flex justify-between gap-4">
          <kbd className="px-2 py-1 bg-white/10 rounded">G</kbd>
          <span>Toggle ghost pacer</span>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/60">
        Hold the {FOCUS_MODE_META[useRideFocusMode.getState().mode].icon} button for quick menu
      </div>
    </motion.div>
  );
}
