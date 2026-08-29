/**
 * RideHUDOverlay v2 — Simplified, phase-reactive HUD.
 *
 * Replaces the current 11+ element HUD with 3 focal points that breathe,
 * pulse, and react to the rider's effort and the interval phase.
 *
 * The HUD has 2 modes:
 *
 * 1. ACTIVE RIDE (default): 3 focal points, nothing else
 *    - Primary metric (biggest, center-bottom)
 *    - Phase badge + time (small, above primary)
 *    - Ghost status (small, beside)
 *
 * 2. EXPANDED (tap to toggle): shows everything else
 *    - Workout plan progress bar
 *    - Coach message
 *    - Settlement stream
 *    - Multi-ghost list
 *    - Gear badge
 *
 * Phase-reactive behavior:
 * - Background glow shifts color with phase
 * - Metric cards breathe (scale up on high effort)
 * - Screen edges pulse during sprints
 * - Particles accelerate with effort
 * - Coach messages dim background when shown
 */

import { memo, useMemo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRideStore } from "@/app/stores/ride-store";
import { useTelemetryStore, selectEffort, selectPower, selectHeartRate, selectCadence, selectGhostState, selectMultiGhostState } from "@/app/stores/telemetry-store";
import { useCoachingStore } from "@/app/stores/coaching-store";
import { useRewardsStore } from "@/app/stores/rewards-store";
import { useUIStore } from "@/app/stores/ui-store";
import { useSensoryStore, useSensoryEvent } from "@/app/stores/sensory-store";
import {
  computePhaseTheme,
  phaseAccent,
  phaseLabel,
  type IntervalPhase,
} from "@/app/lib/phase-theme";
import { YellowRewardTicker } from "@/app/components/features/common/yellow-reward-ticker";
import { RideProgress } from "./ride-progress";
import { SettlementStream } from "./settlement-stream";
import { SpinDripChip } from "./spin-drip-chip";
import type { RewardStreamState } from "@/app/hooks/rewards/use-rewards";
import type { GhostState } from "@/app/lib/analytics/ghost-service";

interface RideHUDOverlayV2Props {
  hudMode: "full" | "compact" | "minimal";
  isRiding: boolean;
  showCompletionScreen: boolean;
  flowTier?: number;
  /** Practice/simulator mode: the PedalSimulator widget doubles as the
   *  integrated bottom bar (phase + Power/HR chips), so this HUD's compact
   *  stack, expanded panel, and tap-zone would overlap it. Suppress them;
   *  ambient glow, coach overlay, and settlement stream still render. */
  suppressBottomStack?: boolean;
}

// Module-scope stable animation config. Passing fresh keyframe arrays / transition
// objects inline on every render makes framer-motion treat them as new targets and
// restart each repeat:Infinity animation — so the ambient loops strobed at the
// telemetry commit rate. Hoisted references stay stable across renders.
const EASE_IN_OUT = "easeInOut" as const;
const BASE_GLOW_KEYFRAMES = [0.6, 0.9, 0.6] as const;
const SPRINT_EDGE_KEYFRAMES = [0.3, 0.8, 0.3] as const;
const PULSE_KEYFRAMES = [1, 1.4, 1] as const;
const INTENSITY_PULSE_TRANSITION = { duration: 2, repeat: Infinity, ease: EASE_IN_OUT } as const;
const SPRINT_EDGE_TRANSITION = { duration: 0.6, repeat: Infinity, ease: EASE_IN_OUT } as const;

// Flow tiers — hoisted so the celebration overlay and the badge share one
// source (and so the celebration effect can read them without re-creating).
const FLOW_LABELS = ["", "Focused", "Flow", "Super Flow", "Mastery"];
const FLOW_COLORS = ["", "#34d399", "#f59e0b", "#f97316", "#ef4444"];

export const RideHUDOverlayV2 = memo(function RideHUDOverlayV2({
  hudMode,
  isRiding,
  showCompletionScreen,
  flowTier = 0,
  suppressBottomStack = false,
}: RideHUDOverlayV2Props) {
  const power = useTelemetryStore(selectPower);
  const heartRate = useTelemetryStore(selectHeartRate);
  const cadence = useTelemetryStore(selectCadence);
  const effort = useTelemetryStore(selectEffort);
  const ghostState = useTelemetryStore(selectGhostState);
  const multiGhostState = useTelemetryStore(selectMultiGhostState);
  const currentInterval = useCoachingStore((s) => s.currentInterval);
  const phase = currentInterval?.phase ?? null;
  const isSpeaking = useCoachingStore((s) => s.isSpeaking);
  const lastCoachMessage = useCoachingStore((s) => s.lastCoachMessage);
  const rewardsActive = useRewardsStore((s) => s.isActive);
  const rewardsStreamState = useRewardsStore((s) => s.streamState);
  const rewardsMode = useRewardsStore((s) => s.mode);
  const rewardsFormatted = useRewardsStore((s) => s.formattedReward);
  const sensoryEvent = useSensoryEvent();

  // ─── Phase theme (drives everything) ────────────────────────────
  const theme = useMemo(
    () => computePhaseTheme(phase as IntervalPhase, effort),
    [phase, effort],
  );

  // Quantize intensity to ~0.1 steps for the *ambient* layer only. effort drifts
  // on every telemetry commit; without quantization the ambient motion.divs get a
  // fresh intensity (→ new keyframe/transition identities → framer-motion tears
  // down and restarts every repeat:Infinity animation) up to 10x/sec.
  const qIntensity = Math.round(theme.intensity * 10) / 10;
  const ambient = useMemo(
    () => ({ ...theme, intensity: qIntensity }),
    // theme's other fields change only on phase change, so gating on
    // phase + qIntensity keeps this object identity stable between commits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, qIntensity],
  );

  const accent = phaseAccent(phase as IntervalPhase);
  const phaseText = phaseLabel(phase as IntervalPhase);

  // ─── Primary metric (adapts to phase) ───────────────────────────
  const primaryMetric = useMemo(() => {
    if (phase === "sprint") {
      return { label: "Cadence", value: cadence, unit: "rpm", color: "text-cyan-300" };
    }
    if (phase === "recovery" || phase === "cooldown") {
      return { label: "Heart Rate", value: heartRate, unit: "bpm", color: "text-sky-300" };
    }
    // Default: power
    return { label: "Power", value: power, unit: "W", color: "text-yellow-300" };
  }, [phase, power, heartRate, cadence]);

  // ─── Secondary metrics ──────────────────────────────────────────
  const secondaryMetrics = useMemo(() => {
    const metrics = [];
    if (phase !== "sprint") {
      metrics.push({ label: "Power", value: power, unit: "W", color: "text-yellow-300" });
    }
    if (phase !== "recovery" && phase !== "cooldown") {
      metrics.push({ label: "Heart Rate", value: heartRate, unit: "bpm", color: "text-rose-300" });
    }
    if (phase !== "sprint") {
      metrics.push({ label: "Cadence", value: cadence, unit: "rpm", color: "text-cyan-300" });
    }
    return metrics.slice(0, 2);
  }, [phase, power, heartRate, cadence]);

  // ─── Ghost status ───────────────────────────────────────────────
  const ghostBadge = useMemo(() => {
    if (!ghostState?.leadLagTime && multiGhostState.length === 0) return null;
    const ghosts = multiGhostState.length > 0 ? multiGhostState : [
      { id: "ghost", leadLagTime: ghostState?.leadLagTime ?? 0, distanceGap: ghostState?.distanceGap ?? 0, name: "Ghost" },
    ];

    const primaryGhost = ghosts[0];
    const isAhead = primaryGhost.leadLagTime < 0;
    const absTime = Math.abs(primaryGhost.leadLagTime);

    return {
      isAhead,
      time: absTime,
      distance: Math.abs(primaryGhost.distanceGap ?? 0),
      name: primaryGhost.name ?? "Ghost",
      color: isAhead ? "text-emerald-400" : "text-rose-400",
    };
  }, [ghostState, multiGhostState]);

  // ─── Expansion state ────────────────────────────────────────────
  const [expanded, setExpanded] = useState(false);

  // ─── Flow state label ─────────────────────────────────────────
  const showFlowBadge = flowTier >= 1;

  // ─── Flow tier rise celebration ─────────────────────────────────
  // A tier escalation is the product's core gamification payoff — it earned
  // more than a 9px pill. On every tier RISE, play a 1.2s full-bleed flash
  // in the tier color with a hero badge; a fall never celebrates.
  const [tierCelebration, setTierCelebration] = useState<number | null>(null);
  const prevTierRef = useRef(flowTier);
  useEffect(() => {
    const prev = prevTierRef.current;
    prevTierRef.current = flowTier;
    if (flowTier > prev && flowTier >= 1) {
      setTierCelebration(flowTier);
      const t = setTimeout(() => setTierCelebration(null), 1400);
      return () => clearTimeout(t);
    }
  }, [flowTier]);

  // Particle layout is random but stable per mount. Math.random is impure, so
  // it can't run during render (React Compiler flags it). useState with a lazy
  // initializer runs exactly once, on mount — the accepted escape hatch for
  // one-time random values that shouldn't shift on re-render.
  const [particles] = useState(() =>
    Array.from({ length: 12 }).map(() => ({
      width: 1 + Math.random() * 3,
      height: 1 + Math.random() * 3,
      left: 10 + Math.random() * 80,
      top: 20 + Math.random() * 60,
      rise: 20 + Math.random() * 30,
      duration: 2 + Math.random() * 2,
      delay: Math.random() * 2,
    })),
  );

  // Early return AFTER all hooks (rules of hooks): quiet/minimal mode renders
  // nothing, but every hook above must always run in the same order.
  if (showCompletionScreen || hudMode === "minimal") return null;

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <>
      {/* ─── Ambient background glow ───────────────────────────────── */}
      {/* Uses the quantized `ambient` theme so these motion.divs only re-render
          when phase changes or intensity crosses a 0.1 step — not every commit. */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        {/* Base phase color */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, ${ambient.bg} 0%, transparent 70%)`,
          }}
          animate={{ opacity: [...BASE_GLOW_KEYFRAMES] }}
          transition={{
            duration: ambient.pulseRate / 1000,
            repeat: Infinity,
            ease: EASE_IN_OUT,
          }}
        />

        {/* Intensity-based radial pulse */}
        {ambient.intensity > 0.5 && (
          <motion.div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${ambient.glow} 0%, transparent 50%)`,
            }}
            animate={{
              scale: [1, 1 + ambient.intensity * 0.15, 1],
              opacity: ambient.intensity * 0.5,
            }}
            transition={INTENSITY_PULSE_TRANSITION}
          />
        )}

        {/* Sprint edge flash */}
        {ambient.screenPulseOpacity > 0 && (
          <motion.div
            className="absolute inset-0"
            style={{
              boxShadow: `inset 0 0 80px 20px ${ambient.color}${Math.round(ambient.screenPulseOpacity * 255).toString(16).padStart(2, "0")}`,
            }}
            animate={{ opacity: [...SPRINT_EDGE_KEYFRAMES] }}
            transition={SPRINT_EDGE_TRANSITION}
          />
        )}

        {/* Particles during high intensity */}
        {ambient.intensity > 0.6 && !expanded && (
          <div className="absolute inset-0">
            {particles.slice(0, Math.floor(ambient.intensity * 12)).map((p, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: p.width,
                  height: p.height,
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  backgroundColor: ambient.particle,
                  opacity: ambient.intensity * 0.4,
                }}
                animate={{
                  y: [0, -p.rise],
                  opacity: [0, ambient.intensity * 0.5, 0],
                  scale: [0.5, 1.5],
                }}
                transition={{
                  duration: p.duration,
                  repeat: Infinity,
                  delay: p.delay,
                  ease: "easeOut",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Flow tier rise celebration (plays even in practice mode) ─ */}
      <AnimatePresence>
        {tierCelebration !== null && (
          <motion.div
            className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.4, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, times: [0, 0.25, 1] }}
            style={{
              background: `radial-gradient(circle at 50% 55%, ${FLOW_COLORS[tierCelebration]}55 0%, transparent 60%)`,
            }}
          >
            <motion.div
              className="rounded-3xl border backdrop-blur-xl px-10 py-6 text-center"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: [0.6, 1.15, 1], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.2, times: [0, 0.3, 0.8, 1] }}
              style={{
                borderColor: `${FLOW_COLORS[tierCelebration]}60`,
                background: `${FLOW_COLORS[tierCelebration]}14`,
                boxShadow: `0 0 80px ${FLOW_COLORS[tierCelebration]}30`,
              }}
            >
              <p
                className="text-4xl font-black uppercase tracking-[0.2em]"
                style={{ color: FLOW_COLORS[tierCelebration] }}
              >
                {FLOW_LABELS[tierCelebration]}
              </p>
              <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-white/50">
                Flow tier up
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Compact HUD (single metric) ───────────────────────────── */}
      {!suppressBottomStack && (expanded ? null : (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-3">
          {/* Phase badge */}
          <motion.div
            className="flex items-center gap-2 rounded-full px-4 py-1.5 border backdrop-blur-xl"
            style={{
              borderColor: `${theme.color}30`,
              backgroundColor: `${theme.color}10`,
            }}
            animate={{
              boxShadow: ambient.intensity > 0.5 ? `0 0 30px ${theme.color}20` : "none",
            }}
          >
            <motion.div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: theme.color }}
              animate={{ scale: [...PULSE_KEYFRAMES] }}
              transition={{ duration: ambient.pulseRate / 1000, repeat: Infinity }}
            />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/80">
              {phaseText}
            </span>
          </motion.div>

          {/* Flow state badge — only shows when rider enters flow */}
          <AnimatePresence>
            {showFlowBadge && (
              <motion.div
                className="flex items-center gap-2 rounded-full px-3 py-1 border backdrop-blur-xl"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                style={{
                  borderColor: `${FLOW_COLORS[flowTier]}30`,
                  backgroundColor: `${FLOW_COLORS[flowTier]}10`,
                }}
              >
                {/* Flow fire/pulse icon */}
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  style={{ color: FLOW_COLORS[flowTier] }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A8 8 0 0117.657 18.657z"
                  />
                </svg>
                <span className="text-[9px] font-black uppercase tracking-[0.25em]" style={{ color: FLOW_COLORS[flowTier] }}>
                  {FLOW_LABELS[flowTier]}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Primary metric — big, central, breathing */}
          <motion.div
            className="relative rounded-[2rem] border bg-black/80 backdrop-blur-2xl px-8 py-6 min-w-[200px]"
            style={{
              borderColor: `${theme.color}20`,
            }}
            // Breathe: scale slightly on high effort. Quantized to 10W steps so the
            // tween target doesn't change on every single-watt telemetry fluctuation.
            animate={{
              scale: 1 + (Math.round(primaryMetric.value / 10) * 10 > 200 ? (Math.round(primaryMetric.value / 10) * 10 - 200) * 0.0003 : 0),
              boxShadow: ambient.intensity > 0.5 ? `0 0 60px ${theme.color}15` : "none",
            }}
          >
            {/* Accent top line */}
            <div
              className="absolute top-0 left-0 w-full h-px"
              style={{
                background: `linear-gradient(90deg, transparent, ${theme.color}40, transparent)`,
              }}
            />

            {/* Metric label */}
            <p className={`text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2 text-center`}>
              {primaryMetric.label}
            </p>

            {/* Metric value */}
            <p
              className={`text-6xl font-black tracking-tighter tabular-nums text-center leading-none`}
              style={{
                color: theme.color,
                textShadow: `${theme.color}20 0 0 20px`,
              }}
            >
              {primaryMetric.value}
              <span className="text-sm font-bold text-white/20 ml-2">{primaryMetric.unit}</span>
            </p>

            {/* Intensity bar at bottom */}
            {theme.intensity > 0.3 && (
              <div className="absolute bottom-2 left-8 right-8 h-0.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: theme.color }}
                  animate={{ scaleX: theme.intensity }}
                  transition={{ type: "tween", duration: 0.3 }}
                />
              </div>
            )}
          </motion.div>

          {/* Ghost badge + secondaries */}
          <div className="flex items-center gap-3">
            {/* Ghost */}
            {ghostBadge && (
              <motion.div
                className="flex flex-col items-center rounded-xl border bg-black/60 backdrop-blur px-3 py-1.5"
                style={{ borderColor: ghostBadge.isAhead ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)" }}
              >
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Ghost</span>
                <span className={`text-sm font-black tabular-nums ${ghostBadge.color}`}>
                  {ghostBadge.isAhead ? "+" : "-"}{ghostBadge.time.toFixed(1)}s
                </span>
              </motion.div>
            )}

            {/* Secondary metrics (horizontal row) */}
            {secondaryMetrics.map((m) => (
              <div
                key={m.label}
                className="flex flex-col items-center rounded-xl border bg-black/40 backdrop-blur px-2.5 py-1"
                style={{ borderColor: "rgba(255,255,255,0.08)" }}
              >
                <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">{m.label}</span>
                <span className={`text-base font-black tabular-nums ${m.color}`}>
                  {m.value}
                </span>
              </div>
            ))}

            {/* Live SPIN accrual — the reward loop stays visible mid-ride */}
            <SpinDripChip />
          </div>
        </div>
      ))}

      {/* ─── Expanded HUD (tap to show everything) ─────────────────── */}
      <AnimatePresence>
        {!suppressBottomStack && expanded && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto w-full max-w-md px-4"
          >
            {/* Tap to collapse */}
            <div
              className="rounded-2xl border bg-black/90 backdrop-blur-2xl p-4 border-white/10"
              onClick={() => setExpanded(false)}
            >
              {/* Phase header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <motion.div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: theme.color }}
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ duration: theme.pulseRate / 1000, repeat: Infinity }}
                  />
                  <span className="text-xs font-black text-white/80 uppercase tracking-wider">
                    {phaseText}
                  </span>
                </div>
                <span className="text-[9px] text-white/40">Tap to collapse</span>
              </div>

              {/* All 4 metrics in a grid */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  { label: "Power", value: power, unit: "W", color: "text-yellow-300" },
                  { label: "HR", value: heartRate, unit: "bpm", color: "text-rose-300" },
                  { label: "Cadence", value: cadence, unit: "rpm", color: "text-cyan-300" },
                  { label: "Effort", value: effort, unit: "/1000", color: "text-purple-300" },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-xl border bg-white/5 p-2 text-center"
                    style={{ borderColor: `${theme.color}15` }}
                  >
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-wider">{m.label}</p>
                    <p className={`text-lg font-black tabular-nums ${m.color}`}>
                      {m.value}
                    </p>
                    <p className="text-[10px] text-white/20">{m.unit}</p>
                  </div>
                ))}
              </div>

              {/* Coach message */}
              {lastCoachMessage && isSpeaking && (
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-2 mb-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    <span className="text-[10px] font-black text-indigo-300 uppercase tracking-wider">Coach</span>
                  </div>
                  <p className="text-[10px] text-white/70 leading-relaxed">{lastCoachMessage}</p>
                </div>
              )}

              {/* Ghost info */}
              {multiGhostState.length > 0 && (
                <div className="flex gap-1.5">
                  {multiGhostState.map((ghost, idx) => {
                    const isAhead = ghost.leadLagTime < 0;
                    return (
                      <div
                        key={ghost.id ?? idx}
                        className="flex items-center gap-1.5 rounded-full border bg-white/5 px-2 py-0.5 text-[9px]"
                        style={{
                          borderColor: isAhead ? "rgba(16,185,129,0.2)" : "rgba(244,63,94,0.2)",
                        }}
                      >
                        <span className={`font-bold ${isAhead ? "text-emerald-400" : "text-rose-400"}`}>
                          {ghost.name ?? "??"}
                        </span>
                        <span className="text-white/40">
                          {isAhead ? "+" : "-"}{Math.abs(ghost.leadLagTime).toFixed(1)}s
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Tap zone to expand ────────────────────────────────────── */}
      {!suppressBottomStack && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto h-8 w-32 rounded-full bg-white/5 border border-white/10 flex items-center justify-center"
          aria-label="Show full HUD"
        >
          <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}

      {/* ─── Coach messages ────────────────────────────────────────── */}
      {/* CoachChannel (mounted by the page, bottom pill) is the single coach
          surface. The old top-quarter CoachMessageOverlay duplicated the
          same message with a second phase-color system — removed. */}

      {/* ─── Settlement stream (behind HUD) ────────────────────────── */}
      {rewardsActive && rewardsStreamState && rewardsMode === "yellow-stream" && (
        <div className="fixed inset-0 pointer-events-none -z-20">
          <SettlementStream />
        </div>
      )}
    </>
  );
});
