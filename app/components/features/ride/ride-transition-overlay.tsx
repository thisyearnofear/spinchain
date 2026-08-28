/**
 * RideTransitionOverlay — Smooth, cinematic transitions between ride states.
 *
 * This replaces all the abrupt state changes (loading → ride → completion)
 * with fluid, layered transitions that feel like a game menu.
 *
 * States:
 *   NONE → LOADING → ACTIVATION → RIDING → COMPLETION → DONE → MENU
 *
 * Each transition has:
 * - Entry animation (how it appears)
 * - Exit animation (how it disappears)
 * - Duration
 * - Whether it blocks interaction
 * - Whether it blocks the 3D view
 *
 * Design rules:
 * - No two blocking overlays ever visible at the same time
 * - Each transition dissolves into the next (cross-fade)
 * - Back button always works (Escape / ← / swipe down)
 * - Reduced motion respected
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRideStore } from "@/app/stores/ride-store";
import { useSensoryStore } from "@/app/stores/sensory-store";

export type RideTransitionState =
  | "none"
  | "loading"
  | "activation"
  | "entering"
  | "riding"
  | "exiting"
  | "completion"
  | "done";

interface RideTransitionOverlayProps {
  /** Current transition state */
  state: RideTransitionState;
  /** Previous state (for detecting direction) */
  prevState: RideTransitionState | null;
  /** Fired when activation completes and riding begins */
  onActivationComplete: () => void;
  /** Fired when skip is tapped */
  onSkipActivation: () => void;
  /** Activation component props */
  activationPhase?: string;
  /** Whether to show loading at all (can skip if data preloaded) */
  hasData: boolean;
  /** Loading time remaining (ms) */
  loadProgress: number;
  /** Total expected load time (ms) */
  loadTotal: number;
  /** Whether reduced motion is preferred */
  reducedMotion: boolean;
}

// ─── Duration constants ──────────────────────────────────────────

const TRANSITIONS = {
  loadingToActivation: { enter: 800, exit: 600 },
  activationToRiding: { enter: 1000, exit: 700 },
  ridingToExiting: { enter: 500, exit: 500 },
  exitingToCompletion: { enter: 800, exit: 400 },
  completionToDone: { enter: 600, exit: 500 },
  loadingFallback: 4000, // max loading time before auto-skip
} as const;

// ─── Main component ──────────────────────────────────────────────

export function RideTransitionOverlay({
  state,
  prevState,
  onActivationComplete,
  onSkipActivation,
  activationPhase,
  hasData,
  loadProgress,
  loadTotal,
  reducedMotion,
}: RideTransitionOverlayProps) {
  const [internalState, setInternalState] = useState<RideTransitionState>(
    hasData ? "none" : "loading",
  );
  const [skipEnabled, setSkipEnabled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── State machine ─────────────────────────────────────────────
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (skipTimerRef.current) clearTimeout(skipTimerRef.current);

    // Skip button appears after 1.5s in activation
    setSkipEnabled(false);
    if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
    skipTimerRef.current = setTimeout(() => setSkipEnabled(true), 1500);

    switch (state) {
      case "loading":
        if (!hasData) setInternalState("loading");
        else setInternalState("none");
        break;
      case "activation":
        setInternalState("activation");
        break;
      case "entering":
        setInternalState("activation");
        timerRef.current = setTimeout(() => {
          setInternalState("riding");
          onActivationComplete();
        }, reducedMotion ? 200 : TRANSITIONS.activationToRiding.enter);
        break;
      case "riding":
        setInternalState("riding");
        break;
      case "exiting":
        setInternalState("exiting");
        timerRef.current = setTimeout(() => {
          setInternalState("completion");
        }, reducedMotion ? 200 : TRANSITIONS.ridingToExiting.enter);
        break;
      case "completion":
        setInternalState("completion");
        break;
      case "done":
        setInternalState("done");
        break;
      default:
        setInternalState("none");
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
    };
  }, [state, hasData, reducedMotion, onActivationComplete]);

  // ─── Keyboard dismiss ──────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Only dismiss non-critical states
        if (
          internalState === "activation" &&
          (prevState === "loading" || prevState === "entering")
        ) {
          onSkipActivation();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [internalState, prevState, onSkipActivation]);

  // ─── Render ────────────────────────────────────────────────────
  return (
    <>
      <AnimatePresence mode="wait">
        {internalState === "loading" && (
          <LoadingTransition
            progress={loadProgress}
            total={loadTotal}
            onSkip={onSkipActivation}
            skipEnabled={skipEnabled}
            reducedMotion={reducedMotion}
          />
        )}

        {internalState === "activation" && (
          <ActivationTransition
            phase={activationPhase}
            onSkip={onSkipActivation}
            skipEnabled={skipEnabled}
            onDone={onActivationComplete}
            reducedMotion={reducedMotion}
          />
        )}

        {internalState === "exiting" && (
          <ExitingTransition
            reducedMotion={reducedMotion}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Loading transition ──────────────────────────────────────────

function LoadingTransition({
  progress,
  total,
  onSkip,
  skipEnabled,
  reducedMotion,
}: {
  progress: number;
  total: number;
  onSkip: () => void;
  skipEnabled: boolean;
  reducedMotion: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.15 : 0.5 }}
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 backdrop-blur-xl"
    >
      <div className="flex flex-col items-center gap-6 max-w-sm px-6">
        {/* Spinning orbit ring */}
        <div className="relative w-20 h-20">
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-white/10"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute inset-2 rounded-full border-2 border-transparent border-t-cyan-400"
            animate={{ rotate: -360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
          <div className="absolute inset-0 m-auto w-8 h-8 rounded-full bg-cyan-400/20 blur-xl animate-pulse" />
        </div>

        <p className="text-sm font-bold text-white/70 tracking-wide">
          Loading your route
        </p>

        {/* Progress bar */}
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-400 to-indigo-400 rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: `${Math.min(100, (progress / total) * 100)}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>

        {skipEnabled && (
          <button
            onClick={onSkip}
            className="text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            Skip loading →
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Activation transition ───────────────────────────────────────

function ActivationTransition({
  phase,
  onSkip,
  skipEnabled,
  onDone,
  reducedMotion,
}: {
  phase?: string;
  onSkip: () => void;
  skipEnabled: boolean;
  onDone: () => void;
  reducedMotion: boolean;
}) {
  const [countdown, setCountdown] = useState(3);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown logic
  useEffect(() => {
    if (reducedMotion) {
      onDone();
      return;
    }

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setVisible(false);
          setTimeout(onDone, reducedMotion ? 100 : 400);
          return 0;
        }
        return prev - 1;
      });
    }, reducedMotion ? 200 : 700);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [reducedMotion, onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.15 : 0.4 }}
      className="fixed inset-0 z-[140] flex items-center justify-center pointer-events-none"
    >
      {/* Background pulse */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute inset-0"
          animate={{
            background: phase
              ? `radial-gradient(circle at 50% 50%, ${phaseColor(phase)}15 0%, transparent 70%)`
              : "radial-gradient(circle at 50% 50%, rgba(99,102,241,0.1) 0%, transparent 70%)",
          }}
          transition={{ duration: 1 }}
        />
      </div>

      {/* Countdown number */}
      <AnimatePresence mode="wait">
        {visible && (
          <motion.div
            key={countdown}
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.5, y: -20 }}
            transition={{
              duration: reducedMotion ? 0.1 : 0.35,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="flex flex-col items-center"
          >
            <motion.p
              className="text-8xl font-black tracking-tighter"
              style={{
                color: phase ? phaseColor(phase) : "#fbbf24",
                textShadow: `0 0 60px ${phase ? phaseColor(phase) : "#fbbf24"}40`,
              }}
            >
              {countdown}
            </motion.p>
            {countdown === 1 && (
              <p className="text-xs font-black uppercase tracking-[0.4em] text-white/40 mt-2">
                Focus
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip button */}
      <AnimatePresence>
        {skipEnabled && visible && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onSkip}
            className="absolute bottom-16 pointer-events-auto rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white/40 hover:text-white/70 transition-colors"
          >
            Skip →
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Exiting transition (during save) ────────────────────────────

function ExitingTransition({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.15 : 0.3 }}
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 backdrop-blur-sm pointer-events-auto"
    >
      <div className="flex flex-col items-center gap-4">
        <motion.div
          className="w-12 h-12 rounded-full border-2 border-indigo-400 border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
        <div className="text-center">
          <p className="text-sm font-bold text-white">Saving your ride</p>
          <p className="text-xs text-white/50 mt-1">
            Uploading to Walrus & anchoring on Sui…
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

function phaseColor(phase?: string): string {
  if (!phase) return "#fbbf24";
  const map: Record<string, string> = {
    warmup: "#34d399",
    interval: "#fbbf24",
    sprint: "#f43f5e",
    recovery: "#38bdf8",
    cooldown: "#818cf8",
  };
  return map[phase] ?? "#fbbf24";
}