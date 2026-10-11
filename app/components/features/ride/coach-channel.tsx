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
import { m, AnimatePresence } from "framer-motion";
import { EASE_MOVE, EASE_SMOOTH } from "@/app/lib/motion";
import { useCoachingStore, selectLastCoachMessage, selectIsSpeaking } from "@/app/stores/coaching-store";
import { useSensoryStore } from "@/app/stores/sensory-store";
import { computePhaseTheme, type IntervalPhase } from "@/app/lib/phase-theme";

// Module-scope stable loop configs: a fresh transition object or a
// duration that flips with isSpeaking restarts the repeat:Infinity loop
// from zero on every telemetry commit.
const ACCENT_LOOP = { duration: 2, repeat: Infinity, ease: EASE_MOVE } as const;
const DOT_LOOP = { duration: 1.5, repeat: Infinity, ease: EASE_MOVE } as const;

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
          <m.div
            key={latestMsg === message ? "latest" : "other"}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.3, ease: EASE_SMOOTH }}
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
            <m.button
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
              {/* Accent bar at top — ONE constant pulse loop; isSpeaking dims
                  via an opacity transition instead of swapping keyframes/duration
                  (the swap restarted the loop on every flip). */}
              <div
                style={{
                  opacity: isSpeaking ? 1 : 0.5,
                  transition: "opacity 300ms var(--ease-smooth)",
                }}
              >
                <m.div
                  className="h-0.5 w-full"
                  style={{ backgroundColor: theme.color }}
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={ACCENT_LOOP}
                />
              </div>

              <div className="px-4 py-3">
                {/* Header */}
                <div className="flex items-center gap-2 mb-2">
                  <m.div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: theme.color,
                    }}
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={DOT_LOOP}
                  />
                  <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                    Coach
                  </span>
                  {isSpeaking && (
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                      Speaking
                    </span>
                  )}
                </div>

                {/* Expand/collapse swap: AnimatePresence so the exit actually
                    plays; the expanded paragraph is keyed by message so a new
                    message re-reveals. No height:"auto" tween — layout property;
                    spring on transform/opacity instead. */}
                <AnimatePresence mode="popLayout" initial={false}>
                  {expanded ? (
                    <m.p
                      key={`full-${message}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                      className="text-sm text-white/80 leading-relaxed pl-4 border-l-2"
                      style={{
                        borderColor: `${theme.color}40`,
                      }}
                    >
                      {message}
                    </m.p>
                  ) : (
                    <p
                      key="compact"
                      className="text-sm text-white/70 pl-4 border-l-2"
                    >
                      {firstLine}
                    </p>
                  )}
                </AnimatePresence>

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
            </m.button>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}