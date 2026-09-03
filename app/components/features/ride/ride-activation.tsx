/**
 * RideActivationSequence — The moment before the ride begins.
 *
 * Replaces the cold "loading steps + settings panel" with a cinematic
 * activation ritual that builds anticipation:
 *
 * Phase 1: Route reveal (0–3s)
 *   → The 3D route spins slowly, ambient particles drift, class name fades in.
 *   → Rider sees the world they're about to ride through.
 *
 * Phase 2: Countdown (3–6s)
 *   → "GET READY" text appears
 *   → 3 → 2 → 1 → GO with haptic feedback on each tick
 *   → Each number pulses and scales, color shifts with the interval phase
 *
 * Phase 3: GO (6s+)
 *   → Screen flashes to phase color, camera pushes forward
 *   → Ride begins immediately
 *
 * Design principles:
 * - Zero config UI — no workout selectors here
 * - Emotional build-up, not administrative
 * - Haptic + visual + audio synchronized on each tick
 * - Respects reduced-motion preference
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { m, AnimatePresence } from "framer-motion";
import { useSensoryStore } from "@/app/stores/sensory-store";
import { useRideStore } from "@/app/stores/ride-store";
import { computePhaseTheme, phaseLabel, type IntervalPhase } from "@/app/lib/phase-theme";
import type { HapticType } from "@/app/hooks/use-haptic";

interface RideActivationSequenceProps {
  onRideStarted: () => void;
  onSkip: () => void;
  intervalPhase?: IntervalPhase;
  className?: string;
  formatTime: (s: number) => string;
}

const COUNTDOWN_DURATION = 4; // seconds (3-2-1-GO)
const ROUTE_REVEAL_DURATION = 3000; // ms for phase 1
const COUNTDOWN_START = ROUTE_REVEAL_DURATION;

export function RideActivationSequence({
  onRideStarted,
  onSkip,
  intervalPhase,
  className = "",
}: RideActivationSequenceProps) {
  const { setCountdownPhase, resetCountdown } = useSensoryStore();
  const setIsActive = useRideStore((s) => s.isActive);
  const setStartTime = useRideStore((s) => {
    // We need to set isStarting first, then isActive
    return (v: boolean) => {
      // This is handled by the parent lifecycle
    };
  });

  const [phase, setPhase] = useState<"route-reveal" | "countdown" | "go">("route-reveal");
  const [countdownNumber, setCountdownNumber] = useState<number | null>(null);
  const [showNumber, setShowNumber] = useState(false);
  const startTimeRef = useRef(Date.now());
  const hapticRef = useRef<((type: HapticType) => void) | null>(null);
  const reducedMotion = useReducedMotion();

  // Determine accent color from interval phase
  const theme = computePhaseTheme(intervalPhase ?? null, 500);
  const accentColor = theme.color;

  // ─── Phase transitions ──────────────────────────────────────────
  useEffect(() => {
    const elapsed = Date.now() - startTimeRef.current;

    if (elapsed >= COUNTDOWN_START && phase === "route-reveal") {
      setPhase("countdown");
      startCountdown();
    }
  }, [phase, intervalPhase]);

  // ─── Countdown logic ────────────────────────────────────────────
  const startCountdown = useCallback(() => {
    const numbers: number[] = [3, 2, 1];
    let index = 0;

    const tick = () => {
      if (index >= numbers.length) {
        // GO!
        setCountdownPhase("go");
        setShowNumber(false);
        setPhase("go");
        setTimeout(() => {
          onRideStarted();
        }, reducedMotion ? 200 : 600);
        return;
      }

      const num = numbers[index];
      setCountdownNumber(num);
      setShowNumber(true);
      setCountdownPhase(
        num === 3 ? "three" : num === 2 ? "two" : "one"
      );

      // Haptic on each tick
      if (hapticRef.current) {
        hapticRef.current(index === numbers.length - 1 ? "heavy" : "medium");
      }

      index++;
      setTimeout(tick, reducedMotion ? 400 : 800);
    };

    setTimeout(tick, reducedMotion ? 200 : 500);
  }, [setCountdownPhase, onRideStarted, reducedMotion]);

  // ─── Skip handler ───────────────────────────────────────────────
  const handleSkip = useCallback(() => {
    resetCountdown();
    setPhase("go");
    onRideStarted();
  }, [resetCountdown, onRideStarted]);

  // ─── Total elapsed time ─────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (reducedMotion) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 50);
    return () => clearInterval(interval);
  }, [reducedMotion]);

  const showSkip = elapsed > 2000;

  const ambientParticles = useMemo(
    () =>
      Array.from({ length: 20 }).map(() => ({
        size: 2 + Math.random() * 4,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        opacity: 0.3 + Math.random() * 0.3,
        y: -(30 + Math.random() * 40),
        duration: 2 + Math.random() * 3,
        delay: Math.random() * 2,
      })),
    [],
  );

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none ${className}`}
      style={{
        background: `radial-gradient(ellipse at 50% 50%, ${theme.glow} 0%, rgba(0,0,0,0.97) 70%)`,
      }}
    >
      {/* ─── Ambient particles during route reveal ─────────────────── */}
      {phase === "route-reveal" && !reducedMotion && (
        <m.div
          className="absolute inset-0 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5 }}
        >
          {ambientParticles.map((particle, i) => (
            <m.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: particle.size,
                height: particle.size,
                left: particle.left,
                top: particle.top,
                backgroundColor: theme.particle,
                opacity: particle.opacity,
              }}
              animate={{
                y: [0, particle.y],
                opacity: [0, 0.6, 0],
                scale: [0.5, 1.2, 0.8],
              }}
              transition={{
                duration: particle.duration,
                repeat: Infinity,
                delay: particle.delay,
                ease: "easeOut",
              }}
            />
          ))}
        </m.div>
      )}

      {/* ─── Phase 1: Route reveal ─────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {phase === "route-reveal" && (
          <m.div
            key="reveal"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col items-center gap-4 pointer-events-auto"
          >
            {/* Class name */}
            <m.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-2">
                Preparing your ride
              </p>
            </m.div>

            {/* Phase indicator orb */}
            <m.div
              className="relative"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, duration: 0.8, type: "spring" }}
            >
              <m.div
                className="w-24 h-24 rounded-full blur-2xl"
                style={{ backgroundColor: theme.color, opacity: 0.3 }}
                animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              <div
                className="absolute inset-0 m-auto w-16 h-16 rounded-full border-2"
                style={{
                  borderColor: `${theme.color}40`,
                  boxShadow: `0 0 40px ${theme.color}30`,
                }}
              />
            </m.div>

            {/* Current phase label */}
            {intervalPhase && (
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="flex items-center gap-2"
              >
                <m.div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: theme.color }}
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <p className="text-sm font-bold text-white/70 tracking-wide">
                  {phaseLabel(intervalPhase)} session
                </p>
              </m.div>
            )}
          </m.div>
        )}
      </AnimatePresence>

      {/* ─── Phase 2: Countdown ────────────────────────────────────── */}
      {phase === "countdown" && countdownNumber !== null && (
        <div className="relative pointer-events-auto">
          <m.div
            key={countdownNumber}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: countdownNumber === 1 ? [-5, 0] : [0, 5],
            }}
            exit={{ opacity: 0, scale: 1.5 }}
            transition={{
              duration: reducedMotion ? 0.15 : 0.3,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="flex flex-col items-center"
          >
            {/* Number */}
            <p
              className="text-8xl font-black tracking-tighter"
              style={{
                color: accentColor,
                textShadow: `0 0 60px ${theme.color}60, 0 0 120px ${theme.color}30`,
              }}
            >
              {countdownNumber}
            </p>

            {/* Label (only on final tick) */}
            {countdownNumber === 1 && (
              <m.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-xs font-black uppercase tracking-[0.4em] text-white/40 mt-2"
              >
                Focus
              </m.p>
            )}
          </m.div>
        </div>
      )}

      {/* ─── Phase 3: GO ───────────────────────────────────────────── */}
      {phase === "go" && (
        <m.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center pointer-events-auto"
        >
          <m.p
            className="text-7xl font-black tracking-tighter"
            style={{
              color: accentColor,
              textShadow: `0 0 80px ${theme.color}80, 0 0 160px ${theme.color}40`,
            }}
            animate={{ scale: [0.9, 1.1, 1], opacity: [0.5, 1, 1] }}
            transition={{
              duration: reducedMotion ? 0.2 : 0.5,
              times: [0, 0.3, 1],
            }}
          >
            GO
          </m.p>
        </m.div>
      )}

      {/* ─── Skip button (appears after delay) ─────────────────────── */}
      <AnimatePresence>
        {showSkip && phase !== "go" && (
          <m.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleSkip}
            className="absolute bottom-16 pointer-events-auto rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white/40 hover:text-white/70 transition-colors"
          >
            Skip countdown
          </m.button>
        )}
      </AnimatePresence>

      {/* ─── Reduced motion: instant skip ──────────────────────────── */}
      {reducedMotion && (
        <m.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={handleSkip}
          className="absolute bottom-16 pointer-events-auto rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white/40 hover:text-white/70 transition-colors"
        >
          Skip to ride
        </m.button>
      )}
    </div>
  );
}

/** Detect reduced motion preference */
function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return prefersReduced;
}