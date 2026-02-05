"use client";

/**
 * VoiceToggle Component - Enable/disable voice features
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Adds to existing UI without replacement
 * - MODULAR: Reusable across components
 * - CLEAN: Clear visual feedback for state
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Mic, MicOff } from "lucide-react";

interface VoiceToggleProps {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  isListening?: boolean;
  onListenToggle?: () => void;
  size?: "sm" | "md" | "lg";
  showMic?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
};

const ICON_SIZES = {
  sm: 14,
  md: 18,
  lg: 22,
};

export function VoiceToggle({
  isEnabled,
  onToggle,
  isListening,
  onListenToggle,
  size = "md",
  showMic = false,
  className = "",
}: VoiceToggleProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleToggle = useCallback(() => {
    onToggle(!isEnabled);
  }, [isEnabled, onToggle]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Main voice toggle */}
      <motion.button
        onClick={handleToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          ${SIZE_CLASSES[size]}
          rounded-full flex items-center justify-center
          transition-colors relative
          ${isEnabled 
            ? "bg-indigo-500 text-white" 
            : "bg-white/10 text-white/50 hover:bg-white/20"
          }
        `}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={isEnabled ? {
          boxShadow: [
            "0 0 0px rgba(99, 102, 241, 0)",
            "0 0 20px rgba(99, 102, 241, 0.5)",
            "0 0 0px rgba(99, 102, 241, 0)",
          ]
        } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <AnimatePresence mode="wait">
          {isEnabled ? (
            <motion.div
              key="on"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ duration: 0.2 }}
            >
              <Volume2 size={ICON_SIZES[size]} />
            </motion.div>
          ) : (
            <motion.div
              key="off"
              initial={{ scale: 0, rotate: 180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: -180 }}
              transition={{ duration: 0.2 }}
            >
              <VolumeX size={ICON_SIZES[size]} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tooltip */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap"
            >
              <span className="text-[10px] uppercase tracking-wider text-white/60 bg-black/80 px-2 py-1 rounded">
                {isEnabled ? "Voice On" : "Voice Off"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Microphone toggle (optional) */}
      {showMic && onListenToggle && (
        <motion.button
          onClick={onListenToggle}
          className={`
            ${SIZE_CLASSES[size]}
            rounded-full flex items-center justify-center
            transition-colors
            ${isListening
              ? "bg-red-500 text-white animate-pulse"
              : "bg-white/10 text-white/50 hover:bg-white/20"
            }
          `}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <AnimatePresence mode="wait">
            {isListening ? (
              <motion.div
                key="listening"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Mic size={ICON_SIZES[size]} />
              </motion.div>
            ) : (
              <motion.div
                key="muted"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <MicOff size={ICON_SIZES[size]} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      )}

      {/* Status label */}
      <span className={`text-xs ${isEnabled ? "text-indigo-400" : "text-white/40"}`}>
        {isEnabled ? "Voice Enabled" : "Voice Disabled"}
      </span>
    </div>
  );
}

export default VoiceToggle;
