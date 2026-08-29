/**
 * CoachChannel — Replace the full-screen CoachMessageOverlay with an
 * unobtrusive, bottom-aligned "coach channel" that sits above the HUD
 * without blocking the 3D world.
 *
 * Design principles:
 * - NEVER covers the 3D scene
 * - Slides up from the bottom panel (like a messaging app)
 * - Auto-dismisses after the coach finishes speaking
 * - Collapses to a pill when idle
 * - Shows the coach's last message in a compact form
 * - Tap to expand for the full message
 * - Mobile: slides up from the bottom panel, desktop: slides in from bottom
 *
 * Visual design:
 * - Compact: small pill with coach icon + first line of message
 * - Expanded: full message card with phase color accent
 * - Speaking: subtle pulse glow
 * - New message: slides up from behind the current pill
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCoachingStore, selectLastCoachMessage, selectIsSpeaking } from "@/app/stores/coaching-store";
import { useSensoryStore } from "@/app/stores/sensory-store";
import { computePhaseTheme, type IntervalPhase } from "@/app/lib/phase-theme";

export function CoachChannel({ className = "" }: { className?: string }) {
  const message = useCoachingStore(selectLastCoachMessage);
  const isSpeaking = useCoachingStore(selectIsSpeaking);
  const phase = useCoachingStore((s) => s.currentInterval?.phase ?? null);
  const [expanded, setExpanded] = useState(false);
  const [latestMsg, setLatestMsg] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const theme = computePhaseTheme(phase as IntervalPhase, 500);

  // Auto-collapse after 5s
  useEffect(() => {
    if (latestMsg) {
      setExpanded(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setExpanded(false), 5000);
    }
  }, [latestMsg]);

  // Track new messages
  useEffect(() => {
    if (message && message !== latestMsg) {
      setLatestMsg(message);
      setExpanded(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setExpanded(false), 6000);
    }
  }, [message, latestMsg]);

  if (!message) return null;

  // First line of the message (for compact view)
  const firstLine = message.length > 60 ? message.slice(0, 60) + "…" : message;

  return (
    <div className={`absolute bottom-28 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pointer-events-auto ${className}`}>
      <AnimatePresence mode="popLayout">
        {latestMsg && (
          <motion.div
            key={latestMsg === message ? "latest" : "other"}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* Glow behind the card */}
            <div
              className="absolute inset-0 blur-xl rounded-2xl"
              style={{
                backgroundColor: theme.color,
                opacity: isSpeaking ? 0.15 : 0.08,
                transition: "opacity 0.3s",
              }}
            />

            {/* Card */}
            <motion.button
              onClick={() => setExpanded(!expanded)}
              className="relative w-full rounded-2xl border bg-black/85 backdrop-blur-xl overflow-hidden"
              style={{
                borderColor: `${theme.color}30`,
                boxShadow: isSpeaking
                  ? `0 0 30px ${theme.color}20`
                  : "0 10px 40px rgba(0,0,0,0.5)",
              }}
              animate={{
                scale: expanded ? 1 : 0.98,
              }}
              whileHover={{ scale: expanded ? 1 : 0.99 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Accent bar at top */}
              <motion.div
                className="h-0.5 w-full"
                style={{ backgroundColor: theme.color }}
                animate={{
                  opacity: isSpeaking ? [0.4, 1, 0.4] : 0.5,
                }}
                transition={{
                  duration: isSpeaking ? 2 : 1,
                  repeat: isSpeaking ? Infinity : 0,
                }}
              />

              <div className="px-4 py-3">
                {/* Header */}
                <div className="flex items-center gap-2 mb-2">
                  <motion.div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: theme.color,
                    }}
                    animate={{
                      scale: isSpeaking ? [1, 1.5, 1] : 1,
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: isSpeaking ? Infinity : 0,
                    }}
                  />
                  <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                    Coach
                  </span>
                  {isSpeaking && (
                    <span className="text-[8px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-full">
                      Speaking
                    </span>
                  )}
                </div>

                {expanded ? (
                  /* Expanded: full message */
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm text-white/80 leading-relaxed pl-4 border-l-2"
                    style={{
                      borderColor: `${theme.color}40`,
                    }}
                  >
                    {message}
                  </motion.p>
                ) : (
                  /* Compact: first line only */
                  <p className="text-sm text-white/70 pl-4 border-l-2">
                    {firstLine}
                  </p>
                )}

                {/* Expand hint */}
                {!expanded && (
                  <div className="flex items-center justify-center mt-2">
                    <svg
                      className="w-3 h-3 text-white/30"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                    <span className="text-[8px] text-white/20 ml-1">
                      Tap to expand
                    </span>
                  </div>
                )}
              </div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}