/**
 * EnhancedFlowBackground — Phase-reactive ambient background for the ride.
 *
 * Replaces the simple FlowBackground with something that truly reacts to:
 * - Interval phase (warmup → sprint → recovery)
 * - Effort intensity (particle count, speed, color saturation)
 * - Sensory events (PR burst, phase change flash)
 *
 * Visual layers:
 * 1. Base gradient (phase color, effort-scaled opacity)
 * 2. Floating particles (count, speed, color based on phase + effort)
 * 3. Grid lines (appear during high effort for "tunnel vision" effect)
 * 4. Event flash (brief screen-wide flash on phase change / PR)
 */

import { useMemo, useState, useEffect } from "react";
import { m, AnimatePresence } from "framer-motion";
import { EASE_MOVE } from "@/app/lib/motion";
import { useRideStore } from "@/app/stores/ride-store";
import { useTelemetryStore, selectEffort, selectCadence } from "@/app/stores/telemetry-store";
import { useCoachingStore, selectCurrentInterval } from "@/app/stores/coaching-store";
import { useUIStore, selectViewMode } from "@/app/stores/ui-store";
import { useSensoryEvent } from "@/app/stores/sensory-store";
import {
  computePhaseTheme,
  type IntervalPhase,
} from "@/app/lib/phase-theme";

export function EnhancedFlowBackground() {
  const isRiding = useRideStore((s) => s.isActive);
  const viewMode = useUIStore(selectViewMode);
  const effort = useTelemetryStore(selectEffort);
  const cadence = useTelemetryStore(selectCadence);
  const currentInterval = useCoachingStore(selectCurrentInterval);
  const phase = currentInterval?.phase ?? null;
  const sensoryEvent = useSensoryEvent();

  // All hooks must run before any early return (react-hooks/rules-of-hooks).
  // Compute phase theme
  const theme = useMemo(
    () => computePhaseTheme(phase as IntervalPhase, effort),
    [phase, effort],
  );

  // Derived values
  const intensity = useMemo(() => {
    if (!phase) return Math.min(1, effort / 100);
    if (phase === "sprint") {
      const [min] = currentInterval?.targetRpm ?? [60, 100];
      return Math.min(1, cadence / min);
    }
    return Math.min(1, effort / 100);
  }, [phase, effort, cadence, currentInterval?.targetRpm]);

  // Quantized intensity (~0.1 steps). Ambient loops must not embed live values:
  // a value-EQUAL fresh array is fine in framer v14, but a value CHANGE restarts
  // the loop from zero — at the 10 Hz commit rate that reads as strobing.
  const qIntensity = Math.round(intensity * 10) / 10;

  // Event flash — decays over 600ms after a sensory event. Uses state +
  // effect to avoid impure Date.now() during render and to animate decay.
  const lastEventType = sensoryEvent?.type;
  const [eventFlashOpacity, setEventFlashOpacity] = useState(0);
  useEffect(() => {
    if (!lastEventType || !sensoryEvent?.timestamp) {
      setEventFlashOpacity(0);
      return;
    }
    const elapsed = Date.now() - sensoryEvent.timestamp;
    if (elapsed > 600) {
      setEventFlashOpacity(0);
      return;
    }
    setEventFlashOpacity((1 - elapsed / 600) * 0.3);
    const t = setTimeout(() => setEventFlashOpacity(0), 600 - elapsed);
    return () => clearTimeout(t);
  }, [lastEventType, sensoryEvent?.timestamp]);

  // Particle count is set once per mount — varying it with intensity remounts
  // and unmounts particle loops mid-ride (churn + visible pop). Intensity is
  // expressed through each particle's opacity/scale instead. useState with a
  // lazy initializer runs exactly once (the repo's pattern for mount-stable
  // values; refs must not be read during render).
  const [particleCount] = useState(() => Math.floor(8 + Math.min(1, intensity) * 24));

  // Grid lines appear at high intensity
  const showGrid = intensity > 0.7;

  // Crossfade with visualization switch — keep mounted for 220ms after
  // leaving immersive so the world doesn't pop. isRiding gate stays hard.
  if (!isRiding) return null;

  return (
    <m.div
      className="fixed inset-0 pointer-events-none overflow-hidden -z-20"
      initial={false}
      animate={{ opacity: viewMode === "immersive" ? 1 : 0 }}
      transition={{ duration: 0.22, ease: EASE_MOVE }}
      style={{ pointerEvents: "none" }}
      aria-hidden={viewMode !== "immersive"}
    >
      {/* ─── Layer 1: Base gradient ──────────────────────────────── */}
      <m.div
        className="absolute inset-0"
        style={{ backgroundColor: theme.color }}
        initial={false}
        animate={{ opacity: 0.04 + qIntensity * 0.08 }}
        transition={{ type: "spring", duration: 0.8, bounce: 0 }}
      />

      {/* ─── Layer 2: Floating particles ─────────────────────────── */}
      {Array.from({ length: particleCount }).map((_, i) => {
        // Each particle gets deterministic but varied properties
        const seed = i * 137.508; // Golden angle distribution
        const x = ((seed * 7.3) % 100);
        const y = ((seed * 3.7) % 100);
        const size = 2 + (i % 5) * 1.5;
        const duration = 4 + (i % 7) * 2;
        const delay = (i % 11) * 0.3;

        // Particle color varies slightly from phase color
        const hueShift = (i % 3) * 20;
        const isWarmPhase = ["sprint", "interval"].includes(phase ?? "");

        return (
          <m.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              left: `${x}%`,
              top: `${y}%`,
              backgroundColor: isWarmPhase
                ? `rgba(255, ${180 + hueShift}, ${100 + hueShift * 0.5}, 1)`
                : `rgba(${100 + hueShift}, ${200 - hueShift}, 255, 1)`,
            }}
            // Drift loops run at a FIXED per-particle duration — a duration
            // derived from live intensity restarts every loop on each commit.
            // Intensity rides on opacity/scale via spring targets instead.
            animate={{
              y: [-20 - (i % 3) * 15, 0],
              x: [(i % 2 === 0 ? -5 : 5), 0],
              opacity: 0.15 + qIntensity * 0.45,
              scale: 0.5 + qIntensity * 0.5,
            }}
            transition={{
              default: { duration, repeat: Infinity, delay, ease: EASE_MOVE },
              opacity: { type: "spring", duration: 0.8, bounce: 0 },
              scale: { type: "spring", duration: 0.8, bounce: 0 },
            }}
          />
        );
      })}

      {/* ─── Layer 3: Grid lines (high intensity only) ───────────── */}
      {showGrid && (
        <m.div
          className="absolute inset-0"
          initial={false}
          // Intensity drives the wrapper's opacity (spring, retargets);
          // the lines themselves loop on fixed keyframes that never restart.
          animate={{ opacity: qIntensity }}
          transition={{ type: "spring", duration: 0.8, bounce: 0 }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <m.div
              key={i}
              className="absolute bg-white/2"
              style={{
                left: `${10 + i * 16}%`,
                top: 0,
                bottom: 0,
                width: 1,
              }}
              animate={{
                opacity: [0, 0.3, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: EASE_MOVE,
              }}
            />
          ))}
          {Array.from({ length: 4 }).map((_, i) => (
            <m.div
              key={`h-${i}`}
              className="absolute bg-white/2"
              style={{
                top: `${15 + i * 20}%`,
                left: 0,
                right: 0,
                height: 1,
              }}
              animate={{
                opacity: [0, 0.2, 0],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                delay: i * 0.15,
                ease: EASE_MOVE,
              }}
            />
          ))}
        </m.div>
      )}

      {/* ─── Layer 4: Event flash (phase change / PR) ────────────── */}
      <AnimatePresence>
        {eventFlashOpacity > 0 && (
          <m.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: eventFlashOpacity }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            style={{
              backgroundColor: theme.color,
            }}
          />
        )}
      </AnimatePresence>

      {/* ─── Sprint edge glow ────────────────────────────────────── */}
      {phase === "sprint" && intensity > 0.6 && (
        <m.div
          className="absolute inset-0"
          style={{
            boxShadow: `inset 0 0 100px 30px ${theme.color}40`,
          }}
          animate={{
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
    </m.div>
  );
}