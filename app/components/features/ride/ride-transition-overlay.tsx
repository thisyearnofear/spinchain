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

import { useEffect, useState, useRef } from "react";
import { m, AnimatePresence } from "framer-motion";
import { useSensoryStore } from "@/app/stores/sensory-store";
import { haptic } from "@/app/hooks/use-haptic";
import {
  playCountdownTickSfx,
  playGoStingerSfx,
} from "@/app/lib/ceremony-sfx";

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
  /** Fired when activation completes and riding begins */
  onActivationComplete: () => void;
  /** Fired when skip is tapped */
  onSkipActivation: () => void;
  /** Activation component props */
  activationPhase?: string;
  /** Optional route thumbnail shown behind the countdown (parallax when motion OK) */
  routeThumbnailUrl?: string | null;
  /** Optional route / class label under the thumbnail reveal */
  routeLabel?: string | null;
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
  onActivationComplete,
  onSkipActivation,
  activationPhase,
  routeThumbnailUrl,
  routeLabel,
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

  // Callers may pass inline/unstable callbacks. If the timers below keyed on
  // callback identity, a parent re-rendering at 10Hz (useFlowState tick)
  // would tear down and restart them every render — the activation countdown
  // would never advance (stuck on "3") and Skip would never appear. Read the
  // latest callbacks through refs so the effects depend only on real state.
  const onActivationCompleteRef = useRef(onActivationComplete);
  const onSkipActivationRef = useRef(onSkipActivation);
  useEffect(() => {
    onActivationCompleteRef.current = onActivationComplete;
    onSkipActivationRef.current = onSkipActivation;
  });

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
          onActivationCompleteRef.current();
        }, reducedMotion ? 200 : TRANSITIONS.activationToRiding.enter);
        break;
      case "riding":
        setInternalState("riding");
        break;
      case "exiting":
        // The live saving overlay lives in ModalStack (isExitingRide).
        // The page never enters this state; fall through to none so the
        // old duplicate ExitingTransition stays dead.
        setInternalState("none");
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
    // Callbacks are read via refs (see above) — deliberately not deps.
  }, [state, hasData, reducedMotion]);

  // ─── Keyboard dismiss ──────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Activation is always skippable (the Skip button only appears after
        // 1.5s; Esc should never make the rider wait). The old check against
        // prevState was dead code — the page always passed prevState={null}.
        if (internalState === "activation") {
          onSkipActivationRef.current();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [internalState]);

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
            routeThumbnailUrl={routeThumbnailUrl}
            routeLabel={routeLabel}
            onSkip={onSkipActivation}
            skipEnabled={skipEnabled}
            onDone={onActivationComplete}
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
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.15 : 0.5 }}
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 backdrop-blur-xl"
    >
      <div className="flex flex-col items-center gap-6 max-w-sm px-6">
        {/* Spinning orbit ring */}
        <div className="relative w-20 h-20">
          <m.div
            className="absolute inset-0 rounded-full border-2 border-white/10"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
          <m.div
            className="absolute inset-2 rounded-full border-2 border-transparent border-t-amber-400"
            animate={{ rotate: -360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
          <div className="absolute inset-0 m-auto w-8 h-8 rounded-full bg-amber-400/20 blur-xl animate-pulse" />
        </div>

        <p className="text-sm font-bold text-white/70 tracking-wide">
          Loading your route
        </p>

        {/* Progress bar */}
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
          <m.div
            className="h-full bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full"
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
    </m.div>
  );
}

// ─── Activation transition ───────────────────────────────────────

function ActivationTransition({
  phase,
  routeThumbnailUrl,
  routeLabel,
  onSkip,
  skipEnabled,
  onDone,
  reducedMotion,
}: {
  phase?: string;
  routeThumbnailUrl?: string | null;
  routeLabel?: string | null;
  onSkip: () => void;
  skipEnabled: boolean;
  onDone: () => void;
  reducedMotion: boolean;
}) {
  const [countdown, setCountdown] = useState(3);
  const [visible, setVisible] = useState(true);
  const [goPhase, setGoPhase] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Same reason as the parent: the countdown interval must not restart when
  // the caller passes an unstable onDone. See RideTransitionOverlay.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  // Dedup sensory fire across Strict Mode / re-renders (one cue per tick value).
  const lastSensoryTickRef = useRef<number | "go" | null>(null);
  const setCountdownPhase = useSensoryStore((s) => s.setCountdownPhase);
  const resetCountdown = useSensoryStore((s) => s.resetCountdown);
  const setLatestEvent = useSensoryStore((s) => s.setLatestEvent);

  const accent = phase ? phaseColor(phase) : "#fbbf24";

  // Countdown logic. The updater must stay pure (React dev double-invokes
  // updaters, which would fire side effects twice); completion is handled in
  // its own effect watching `countdown`.
  // prefers-reduced-motion: skip ticks/parallax — brief GO fade + immediate handoff.
  useEffect(() => {
    if (reducedMotion) {
      setCountdown(0);
      setGoPhase(true);
      onDoneRef.current();
      const fadeTimer = setTimeout(() => {
        setGoPhase(false);
        setVisible(false);
        resetCountdown();
      }, 180);
      return () => {
        clearTimeout(fadeTimer);
      };
    }

    timerRef.current = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 700);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // onDone is read via ref (see above) — deliberately not a dep.
  }, [reducedMotion, resetCountdown]);

  // Sensory sync on each visible tick + GO: haptic + local SFX + store event.
  // Local Web Audio (not ElevenLabs playCountdown) keeps ticks aligned to the
  // 700ms visual interval and avoids a second delayed ceremony in lifecycle.
  useEffect(() => {
    if (reducedMotion) return;

    if (countdown > 0) {
      if (lastSensoryTickRef.current === countdown) return;
      lastSensoryTickRef.current = countdown;
      const tickPhase =
        countdown === 3 ? "three" : countdown === 2 ? "two" : "one";
      setCountdownPhase(tickPhase);
      setLatestEvent({
        type: "countdown-tick",
        timestamp: Date.now(),
      });
      // 3/2 medium; 1 heavy — builds into the GO stinger.
      haptic(countdown === 1 ? "heavy" : "medium");
      playCountdownTickSfx(countdown as 1 | 2 | 3);
      return;
    }

    // countdown === 0 → GO
    if (lastSensoryTickRef.current === "go") return;
    lastSensoryTickRef.current = "go";
    setCountdownPhase("go");
    setLatestEvent({
      type: "countdown-go",
      timestamp: Date.now(),
    });
    haptic("heavy");
    playGoStingerSfx();
  }, [countdown, reducedMotion, setCountdownPhase, setLatestEvent]);

  // Countdown finished: stop the interval, show GO, and hand off immediately
  // so isActive / pedals work on GO (parent keeps the overlay mounted briefly
  // for the launch flash). No second ceremony after this.
  useEffect(() => {
    if (countdown !== 0) return;
    if (reducedMotion) return; // reduced-motion path owns fade + handoff
    if (timerRef.current) clearInterval(timerRef.current);
    setGoPhase(true);
    onDoneRef.current();
    const fadeTimer = setTimeout(() => {
      setGoPhase(false);
      setVisible(false);
      resetCountdown();
    }, 650);
    return () => {
      clearTimeout(fadeTimer);
    };
  }, [countdown, reducedMotion, resetCountdown]);

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.15 : 0.4 }}
      className="fixed inset-0 z-[140] flex items-center justify-center pointer-events-none"
      data-activation-ceremony="true"
      data-reduced-motion={reducedMotion ? "true" : "false"}
      data-has-thumbnail={routeThumbnailUrl ? "true" : "false"}
    >
      {/* Route thumbnail under / behind countdown (subtle parallax when motion OK) */}
      {routeThumbnailUrl ? (
        <div
          className="absolute inset-0 overflow-hidden"
          data-testid="activation-route-thumbnail"
        >
          <m.img
            src={routeThumbnailUrl}
            alt={routeLabel ? `${routeLabel} route preview` : "Route preview"}
            className="absolute inset-0 h-[118%] w-full object-cover"
            initial={
              reducedMotion
                ? { opacity: 0.32, scale: 1, y: "0%" }
                : { opacity: 0, scale: 1.12, y: "6%" }
            }
            animate={
              reducedMotion
                ? { opacity: goPhase ? 0.12 : 0.32, scale: 1, y: "0%" }
                : {
                    opacity: goPhase ? 0.1 : 0.48,
                    scale: goPhase ? 1.22 : [1.1, 1.16],
                    y: goPhase ? "0%" : ["5%", "-2%"],
                  }
            }
            transition={
              reducedMotion
                ? { duration: 0.2 }
                : goPhase
                  ? { duration: 0.65, ease: [0.22, 1, 0.36, 1] }
                  : {
                      opacity: { duration: 0.7 },
                      scale: {
                        duration: 4.5,
                        ease: "linear",
                        repeat: Infinity,
                        repeatType: "mirror",
                      },
                      y: {
                        duration: 4.5,
                        ease: "linear",
                        repeat: Infinity,
                        repeatType: "mirror",
                      },
                    }
            }
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/85" />
        </div>
      ) : (
        <div className="absolute inset-0 overflow-hidden">
          <m.div
            className="absolute inset-0"
            animate={{
              background: phase
                ? `radial-gradient(circle at 50% 50%, ${accent}15 0%, transparent 70%)`
                : "radial-gradient(circle at 50% 50%, rgba(99,102,241,0.1) 0%, transparent 70%)",
            }}
            transition={{ duration: 1 }}
          />
        </div>
      )}

      {/* Soft phase wash above thumbnail */}
      <m.div
        className="absolute inset-0"
        animate={{
          background: `radial-gradient(circle at 50% 42%, ${accent}${goPhase ? "33" : "18"} 0%, transparent 62%)`,
        }}
        transition={{ duration: reducedMotion ? 0.15 : 0.55 }}
      />

      {/* GO flash — dissolves into the live 3D world (parent unmounts ~700ms) */}
      {goPhase && (
        <m.div
          key="go-flash"
          className="absolute inset-0"
          data-testid="activation-go-flash"
          initial={{ opacity: reducedMotion ? 0.35 : 0.7 }}
          animate={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.18 : 0.65, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: `radial-gradient(circle at 50% 45%, ${accent}cc 0%, ${accent}33 28%, transparent 62%)`,
          }}
        />
      )}

      {/* Countdown number → GO launch beat */}
      <AnimatePresence mode="wait">
        {visible && countdown > 0 && !reducedMotion && (
          <m.div
            key={countdown}
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: [0.92, 1.08, 1], y: 0 }}
            exit={{ opacity: 0, scale: 1.5, y: -20 }}
            transition={{
              duration: 0.55,
              ease: [0.22, 1, 0.36, 1],
              times: [0, 0.45, 1],
            }}
            className="relative z-10 flex flex-col items-center"
            data-testid="activation-countdown-pulse"
          >
            <m.p
              className="text-8xl font-black tracking-tighter"
              animate={{
                textShadow: [
                  `0 0 40px ${accent}30`,
                  `0 0 70px ${accent}70`,
                  `0 0 50px ${accent}40`,
                ],
              }}
              transition={{ duration: 0.7, ease: "easeInOut" }}
              style={{ color: accent }}
            >
              {countdown}
            </m.p>
            <p className="text-xs font-black uppercase tracking-[0.4em] text-white/40 mt-2">
              {countdown === 3 ? "Ready" : countdown === 2 ? "Set" : "Focus"}
            </p>
            {routeLabel && countdown === 3 && (
              <p className="mt-3 max-w-[16rem] truncate text-center text-[10px] font-bold uppercase tracking-[0.28em] text-white/35">
                {routeLabel}
              </p>
            )}
          </m.div>
        )}
        {visible && (countdown === 0 || reducedMotion) && goPhase && (
          <m.div
            key="go"
            initial={{ opacity: 0, scale: reducedMotion ? 0.92 : 0.4 }}
            animate={{
              opacity: reducedMotion ? [0, 1, 0.85] : [0, 1, 1],
              scale: reducedMotion ? [0.92, 1, 1] : [0.4, 1.25, 1],
            }}
            exit={{ opacity: 0, scale: 1.6 }}
            transition={{
              duration: reducedMotion ? 0.18 : 0.5,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="relative z-10 flex flex-col items-center"
          >
            <m.p
              className="text-9xl font-black tracking-tighter"
              style={{
                color: accent,
                textShadow: `0 0 80px ${accent}60`,
              }}
            >
              GO
            </m.p>
            {!reducedMotion && (
              <p className="text-xs font-black uppercase tracking-[0.4em] text-white/50 mt-2">
                Start pedaling
              </p>
            )}
          </m.div>
        )}
      </AnimatePresence>

      {/* Skip button */}
      <AnimatePresence>
        {skipEnabled && visible && !goPhase && (
          <m.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onSkip}
            className="absolute bottom-16 z-10 pointer-events-auto rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white/40 hover:text-white/70 transition-colors"
          >
            Skip →
          </m.button>
        )}
      </AnimatePresence>
    </m.div>
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

/** Map class route theme → existing public route thumbnail assets. */
export function routeThumbnailForTheme(
  theme?: string | null,
): string {
  switch ((theme ?? "").toLowerCase()) {
    case "alpine":
      return "/images/routes/route-mountain.jpg";
    case "mars":
      return "/images/routes/route-coastal.jpg";
    case "anime":
      return "/images/routes/route-forest.jpg";
    case "rainbow":
      return "/images/routes/route-group.jpg";
    case "neon":
    default:
      return "/images/routes/route-city.jpg";
  }
}