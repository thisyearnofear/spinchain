"use client";

/**
 * CommandPalette Component - Display available voice commands
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Adds to existing UI
 * - ACCESSIBLE: Shows users what's possible
 * - MODULAR: Can be triggered from anywhere
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, X, ChevronRight } from "lucide-react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  lastCommand?: string | null;
  confidence?: number;
}

const COMMAND_CATEGORIES = {
  pace: {
    label: "Pace Control",
    icon: "⚡",
    commands: ["slow down", "speed up", "hold this pace"],
  },
  resistance: {
    label: "Resistance",
    icon: "🔧",
    commands: ["more resistance", "less resistance"],
  },
  info: {
    label: "Information",
    icon: "📊",
    commands: ["what's my heart rate", "how much time", "how far"],
  },
  motivation: {
    label: "Motivation",
    icon: "🔥",
    commands: ["give me motivation", "cheer me on"],
  },
  music: {
    label: "Music",
    icon: "🎵",
    commands: ["next song", "volume up", "volume down"],
  },
  emergency: {
    label: "Emergency",
    icon: "🛑",
    commands: ["stop", "pause", "resume"],
  },
};

export function CommandPalette({
  isOpen,
  onClose,
  lastCommand,
  confidence = 0,
}: CommandPaletteProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="bg-[color:var(--surface)] rounded-2xl border border-[color:var(--border)] max-w-lg w-full max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-[color:var(--border)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center">
                  <Mic className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[color:var(--foreground)]">
                    Voice Commands
                  </h3>
                  <p className="text-sm text-[color:var(--muted)]">
                    Say any command during your ride
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Last command feedback */}
            {lastCommand && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 bg-indigo-500/20 rounded-lg border border-indigo-500/30"
              >
                <p className="text-sm text-indigo-300">
                  Heard: <span className="font-semibold text-white">&quot;{lastCommand}&quot;</span>
                </p>
                <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-indigo-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${confidence * 100}%` }}
                  />
                </div>
              </motion.div>
            )}
          </div>

          {/* Command categories */}
          <div className="p-6 overflow-y-auto max-h-[50vh]">
            <div className="space-y-4">
              {Object.entries(COMMAND_CATEGORIES).map(([key, category]) => (
                <div
                  key={key}
                  className="t-acc rounded-xl border border-[color:var(--border)] overflow-hidden"
                  data-open={activeCategory === key}
                >
                  <button
                    onClick={() =>
                      setActiveCategory(activeCategory === key ? null : key)
                    }
                    aria-expanded={activeCategory === key}
                    className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{category.icon}</span>
                      <span className="font-medium text-[color:var(--foreground)]">
                        {category.label}
                      </span>
                    </div>
                    <span className={`t-acc-chevron ${activeCategory === key ? "rotate-90" : ""}`}>
                      <ChevronRight className="w-5 h-5" />
                    </span>
                  </button>

                  <div className="t-acc-panel">
                    <div className="t-acc-panel-inner">
                      <div className="p-4 pt-0 space-y-2">
                        {category.commands.map((cmd) => (
                          <div
                            key={cmd}
                            className="flex items-center gap-3 p-3 rounded-lg bg-white/5"
                          >
                            <Mic className="w-4 h-4 text-indigo-400" />
                            <span className="text-sm text-[color:var(--foreground)] capitalize">
                              &quot;{cmd}&quot;
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer tip */}
          <div className="p-4 bg-white/5 border-t border-[color:var(--border)] text-center">
            <p className="text-xs text-[color:var(--muted)]">
              Tip: Speak clearly and wait for the beep before giving a command
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Compact trigger button for inline use
export function CommandPaletteTrigger({
  onClick,
  isListening,
}: {
  onClick: () => void;
  isListening?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-full
        ${isListening 
          ? "bg-red-500 text-white animate-pulse" 
          : "bg-white/10 text-white/70 hover:bg-white/20"
        }
        transition-colors
      `}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Mic className="w-4 h-4" />
      <span className="text-xs font-medium">
        {isListening ? "Listening..." : "Voice Commands"}
      </span>
    </motion.button>
  );
}

export default CommandPalette;
