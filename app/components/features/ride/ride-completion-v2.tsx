/**
 * RideCompletionV2 — The peak emotional moment of the ride arc.
 *
 * Replaces the administrative "3-tab dashboard" with a celebration sequence:
 *
 * Phase 1: CELEBRATE (0–2s)
 *   → Big "DONE" text with particle burst
 *   → PR detection + celebration if a PR was beaten
 *   → Agent debrief as hero message (not in a tab)
 *
 * Phase 2: STATS (2–4s)
 *   → Clean stat row (HR, Power, Effort, Duration)
 *   → SPIN earned (big, golden)
 *   → Ghost comparison summary
 *
 * Phase 3: ACTIONS (4s+)
 *   → Share card as primary action
 *   → Ride again / view history
 *   → Storage/claim/walrus in a collapsed "details" section
 *
 * Design principles:
 * - Celebration first, stats second, infrastructure last
 * - PR moments get their own celebration
 * - Agent debrief is the emotional anchor
 * - Share card is the hero action
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { m, AnimatePresence } from "framer-motion";
import { modalTransition } from "@/app/lib/motion";
import { formatTime } from "@/app/lib/formatters";
import { toPracticeWallElapsed } from "@/app/lib/practice-demo";
import { useCoachingStore } from "@/app/stores/coaching-store";
import { useSensoryStore } from "@/app/stores/sensory-store";
import { Star, CheckCircle2, ShieldCheck, Trophy, Flame, Volume2 } from "lucide-react";
import { milestonesAndStreaks, type SessionMilestone, type MilestoneTier, MILESTONE_TIERS } from "@/app/lib/milestones";
import { ShareCardButton } from "./share-card";
import { RideComparison } from "./ride-comparison";
import { getEffortTier } from "@/app/lib/analytics/ride-history";
import { ANALYTICS_EVENTS, trackEvent } from "@/app/lib/analytics/events";
import type { RewardClaimStatus } from "@/app/lib/rewards";

/** Highest tier first — order used by the milestone summary chips. */
const MILESTONE_TIER_ORDER: MilestoneTier[] = ["diamond", "platinum", "gold", "silver", "bronze"];

interface RideCompletionV2Props {
  isPracticeMode: boolean;
  walletConnected: boolean;
  elapsedTime: number;
  /** Class duration in seconds — used to convert compressed demo elapsed → wall clock. */
  classDurationSec?: number;
  /** Peak flow tier reached this ride — shown on practice completion. */
  flowTier?: number;
  avgHeartRate: number;
  avgPower: number;
  avgEffort: number;
  telemetrySource: "live-bike" | "simulator" | "estimated";
  onExit: () => void;
  onRideAgain?: () => void;
  onShare?: () => void;
  onClaimRewards?: () => void;
  /** Opens the wallet connect modal. When provided and the wallet is
   *  disconnected, the claim button becomes the conversion CTA
   *  ("Connect Wallet to Claim · X SPIN") instead of a disabled stub. */
  onConnectWallet?: () => void;
  onExportTCX?: () => void;
  /** Optional vocal replay of the coach debrief (TTS) — debrief text is
   *  passed back so the page owns the voice pipeline. */
  onSpeakDebrief?: (text: string) => void;
  rewardClaimStatus?: RewardClaimStatus;
  spinEarned?: string;
  agentName?: string;
  agentPersonality?: "zen" | "drill-sergeant" | "data";
  walrusAnchorInfo?: { blobId: string; txDigest?: string } | null;
  classId?: string;
  completedRideId?: string;
  settlementStatus?: "pending" | "confirmed" | "failed" | "skipped";
  primaryAction?: "view_history" | "claim" | "exit";
  maxHeartRate?: number;
  maxPower?: number;
  peakEffort?: number;
  rideMilestones?: SessionMilestone[];
}

type CompletionPhase = "celebration" | "stats" | "actions";

const FLOW_LABELS = ["", "Focused", "Flow", "Super Flow", "Mastery"];
const FLOW_COLORS = ["", "#34d399", "#f59e0b", "#f97316", "#ef4444"];

export function RideCompletionV2({
  isPracticeMode,
  walletConnected,
  elapsedTime,
  classDurationSec = 45 * 60,
  flowTier = 0,
  avgHeartRate,
  avgPower,
  avgEffort,
  telemetrySource,
  onExit,
  onRideAgain,
  onShare,
  onClaimRewards,
  onConnectWallet,
  onExportTCX,
  onSpeakDebrief,
  rewardClaimStatus,
  spinEarned = "0",
  agentName = "Coach",
  agentPersonality = "data",
  walrusAnchorInfo = null,
  classId,
  completedRideId,
  settlementStatus,
  primaryAction,
  maxHeartRate = avgHeartRate,
  maxPower = avgPower,
  peakEffort = avgEffort,
  rideMilestones = [],
}: RideCompletionV2Props) {
  const [completionPhase, setCompletionPhase] = useState<CompletionPhase>("celebration");
  const [prBeaten, setPrBeaten] = useState(false);
  const [rating, setRating] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [earnedMilestones, setEarnedMilestones] = useState<SessionMilestone[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  
  // Use passed-in milestones from ride page (set when ride completes)
  useEffect(() => {
    if (rideMilestones.length > 0) {
      setEarnedMilestones(rideMilestones);
    }
    
    // Load current streak
    setCurrentStreak(milestonesAndStreaks.getCurrentStreak());
  }, [rideMilestones]);

  const [showMilestones, setShowMilestones] = useState(false);

  // Hero moment: the single highest-tier milestone earned this ride.
  const heroMilestone = earnedMilestones.reduce<SessionMilestone | null>(
    (best, m) =>
      !best || MILESTONE_TIERS[m.tier].scale > MILESTONE_TIERS[best.tier].scale ? m : best,
    null,
  );

  const tierCounts = earnedMilestones.reduce<Partial<Record<MilestoneTier, number>>>(
    (acc, m) => {
      acc[m.tier] = (acc[m.tier] ?? 0) + 1;
      return acc;
    },
    {},
  );

  // Drawer lists milestones best-first, then in the order they were earned.
  const sortedMilestones = [...earnedMilestones].sort(
    (a, b) => MILESTONE_TIERS[b.tier].scale - MILESTONE_TIERS[a.tier].scale,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  // Particle layout is random but stable per mount (Math.random is impure
  // during render — useState lazy init runs once on mount).
  const [celebrationParticles] = useState(() =>
    Array.from({ length: 30 }).map(() => ({
      width: 2 + Math.random() * 4,
      height: 2 + Math.random() * 4,
      left: 30 + Math.random() * 40,
      top: 40 + Math.random() * 20,
      xStart: -50 + Math.random() * 100,
      xEnd: -80 - Math.random() * 60,
      yStart: -30 - Math.random() * 50,
      yEnd: 100 + Math.random() * 80,
      rotate: 180 + Math.random() * 360,
      duration: 1.5 + Math.random() * 1,
      delay: Math.random() * 0.5,
    })),
  );

  // Check if PR was beaten (from store)
  const storePrBeaten = useCoachingStore((s) => s.prBeaten);
  useEffect(() => {
    if (storePrBeaten) {
      setPrBeaten(true);
      // Fire a celebration sensory event
      useSensoryStore.getState().setLatestEvent({
        type: "pr-beat",
        timestamp: Date.now(),
      });
    }
  }, [storePrBeaten]);

  // ─── Milestone Detection ─────────────────────────────────────
  // Milestones are passed in from the ride page when the ride completes.
  // No need to detect here — just load streak from persistent storage.
  useEffect(() => {
    setCurrentStreak(milestonesAndStreaks.getCurrentStreak());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Practice/demo: show wall-clock duration, not the compressed class clock
  // (which would read as a full 30-min session after a ~45s demo).
  const displayElapsed = isPracticeMode
    ? toPracticeWallElapsed(elapsedTime, classDurationSec)
    : elapsedTime;

  // Agent debrief
  const getAgentDebrief = useCallback(() => {
    const tierInfo = getEffortTier(avgEffort);
    const effortTier = tierInfo.label;
    const hrEfficiency =
      avgHeartRate > 0 && avgPower > 0
        ? (avgPower / avgHeartRate).toFixed(1)
        : null;

    if (agentPersonality === "drill-sergeant") {
      if (effortTier === "elite") {
        return `Outstanding work. ${avgPower}W average. ${hrEfficiency ? `Power-to-HR ratio: ${hrEfficiency} — ` : ""}I've flagged this session for a threshold increase next time. You earned every token.`;
      }
      return `${avgPower}W average with ${avgEffort}/1000 effort. ${effortTier === "strong" ? "Not bad, but I know you have more." : "We're building your base. Next session, I'm pushing you harder."}`;
    }

    if (agentPersonality === "zen") {
      return `A mindful ${formatTime(displayElapsed)} session. Your body sustained ${avgPower}W with a steady rhythm. ${effortTier === "elite" ? "Today you found your flow state." : "Each ride deepens your practice."} I've noted this for your journey.`;
    }

    return `Session analysis: ${formatTime(displayElapsed)} duration, ${avgPower}W avg power, ${avgHeartRate} BPM avg HR. ${hrEfficiency ? `Efficiency ratio: ${hrEfficiency}. ` : ""}Effort score ${avgEffort}/1000 (${effortTier}). ${effortTier === "elite" ? "Performance logged — recommending threshold increase." : `Target: push above ${avgEffort < 500 ? 500 : 800} next ride for higher SPIN yield.`}`;
  }, [agentPersonality, avgPower, avgHeartRate, avgEffort, displayElapsed]);

  // Auto-advance to stats after celebration
  useEffect(() => {
    const timer = setTimeout(() => {
      setCompletionPhase("stats");
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Track completion view
  useEffect(() => {
    if (!isPracticeMode) {
      trackEvent(ANALYTICS_EVENTS.PREMIUM_UPSELL_VIEWED, {
        telemetrySource,
      });
    }
  }, [isPracticeMode, telemetrySource]);

  return (
    <m.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="absolute inset-0 z-10 flex items-center justify-center pointer-events-auto p-4 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-title"
      tabIndex={-1}
      style={{
        background: "radial-gradient(ellipse at 50% 30%, rgba(251,191,36,0.10) 0%, rgba(7,9,15,0.98) 60%), #07090f",
      }}
    >
      {/* Atmospheric glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-amber-500/8 blur-[120px] rounded-full pointer-events-none" />

      {/* ─── Phase 1: CELEBRATION ────────────────────────────────── */}
      {completionPhase === "celebration" && (
        <m.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...modalTransition, delay: 0.1 }}
          className="relative w-full max-w-md flex flex-col items-center text-center"
        >
          {/* Celebration particles */}
          <m.div
            className="absolute inset-0 overflow-hidden pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {celebrationParticles.map((p, i) => (
              <m.div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: p.width,
                  height: p.height,
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  backgroundColor: [
                    "#fbbf24", "#f43f5e", "#34d399", "#38bdf8", "#818cf8",
                  ][i % 5],
                }}
                animate={{
                  x: [p.xStart, p.xEnd],
                  y: [p.yStart, p.yEnd],
                  opacity: [0, 1, 0],
                  scale: [0, 1.5, 0.5],
                  rotate: [0, p.rotate],
                }}
                transition={{
                  duration: p.duration,
                  delay: p.delay,
                  ease: "easeOut",
                }}
              />
            ))}
          </m.div>

          {/* Done text */}
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <p className="text-[10px] uppercase tracking-[0.4em] text-amber-300/60 mb-2">
              {isPracticeMode ? "Demo Complete" : "Session Complete"}
            </p>
            <m.h2
              className="text-5xl font-black text-white tracking-tighter"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 20 }}
            >
              DONE
            </m.h2>
          </m.div>

          {/* PR celebration */}
          <AnimatePresence>
            {prBeaten && (
              <m.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: 0.8, duration: 0.4 }}
                className="mt-4 flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 px-4 py-2"
              >
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-amber-300">New Personal Record!</span>
              </m.div>
            )}
          </AnimatePresence>

          {/* Duration + Phase */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 flex items-center gap-3 text-white/60"
          >
            <span className="text-xs">{formatTime(displayElapsed)}{isPracticeMode ? " demo" : ""}</span>
            <span>·</span>
            <span className="text-xs">{isPracticeMode ? "Demo" : telemetrySource === "live-bike" ? "Live" : telemetrySource === "simulator" ? "Simulator" : "Estimated"}</span>
          </m.div>

          {/* Agent debrief */}
          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="mt-6 w-full"
          >
            <div className="relative pl-4 border-l-2 border-amber-400/40">
              <p className="text-xs leading-relaxed text-white/60 italic">
                &ldquo;{getAgentDebrief()}&rdquo;
              </p>
            </div>
          </m.div>
        </m.div>
      )}

      {/* ─── Phase 2: STATS ────────────────────────────────────────
          Progressive disclosure: one hero moment, one line of truth,
          everything else a tap away. The column scrolls so nothing is
          ever unreachable (the action bar floats over the bottom). */}
      {completionPhase === "stats" && (
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative w-full max-w-lg h-full max-h-full flex flex-col"
        >
          <h2 id="completion-title" className="sr-only">
            Ride complete — performance debrief
          </h2>

          <div className="flex-1 overflow-y-auto px-1 pt-6 pb-52 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Hero — the ride's single best moment (peak-end rule) */}
            {heroMilestone && (
              <m.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="relative mb-6 text-center"
              >
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-3xl pointer-events-none"
                  style={{ backgroundColor: MILESTONE_TIERS[heroMilestone.tier].bgColor }}
                />
                <m.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 16 }}
                  className="relative text-5xl leading-none mb-2"
                >
                  {MILESTONE_TIERS[heroMilestone.tier].icon}
                </m.div>
                <p
                  className="relative text-2xl font-black tracking-tight"
                  style={{ color: MILESTONE_TIERS[heroMilestone.tier].color }}
                >
                  {heroMilestone.title}
                </p>
                <p className="relative mt-1 text-[10px] uppercase tracking-[0.3em] text-white/60 font-bold">
                  {MILESTONE_TIERS[heroMilestone.tier].label} milestone
                  <span className="normal-case tracking-normal font-normal"> · {heroMilestone.description}</span>
                </p>
              </m.div>
            )}

            {/* Flow peak — practice completion leads with flow + milestones */}
            {flowTier >= 1 && (
              <div className="mb-4 flex items-center justify-center">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest"
                  style={{
                    borderColor: `${FLOW_COLORS[flowTier]}40`,
                    backgroundColor: `${FLOW_COLORS[flowTier]}14`,
                    color: FLOW_COLORS[flowTier],
                  }}
                >
                  {FLOW_LABELS[flowTier]} flow
                </span>
              </div>
            )}

            {/* PR celebration */}
            {prBeaten && !heroMilestone && (
              <div className="mb-6 flex items-center justify-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span className="text-xl font-black text-amber-300">New Personal Record!</span>
              </div>
            )}

            {/* Coach's note + optional vocal replay */}
            <div className="relative pl-4 border-l-2 border-amber-400/40 mb-6">
              <p className="text-[9px] uppercase tracking-widest text-white/60 font-bold mb-1">
                {agentName}&apos;s Notes
              </p>
              <p className="text-xs leading-relaxed text-white/70 italic">
                &ldquo;{getAgentDebrief()}&rdquo;
              </p>
              {onSpeakDebrief && (
                <button
                  onClick={() => onSpeakDebrief(getAgentDebrief())}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white/50 transition-colors hover:text-white hover:bg-white/10"
                  aria-label="Hear the coach read the debrief aloud"
                >
                  <Volume2 className="w-3 h-3" />
                  Hear debrief
                </button>
              )}
            </div>

            {/* One line of truth — typographic, no cards */}
            <div className="mb-6 text-center">
              <div className="flex items-baseline justify-center flex-wrap gap-x-2.5 gap-y-1 text-white/20">
                <InlineStat value={avgHeartRate} unit="bpm" />
                <span aria-hidden>·</span>
                <InlineStat value={avgPower} unit="W" />
                <span aria-hidden>·</span>
                <InlineStat value={avgEffort} unit="/1000" highlight />
                <span aria-hidden>·</span>
                <InlineStat value={formatTime(displayElapsed)} unit={isPracticeMode ? "demo" : ""} />
              </div>
              {(maxPower > avgPower || maxHeartRate > avgHeartRate) && (
                <p className="mt-1.5 text-[11px] text-white/35 tabular-nums">
                  peaks{" "}
                  {maxPower > avgPower && (
                    <span><span className="text-white/60 font-semibold">{maxPower}W</span></span>
                  )}
                  {maxPower > avgPower && maxHeartRate > avgHeartRate && " · "}
                  {maxHeartRate > avgHeartRate && (
                    <span><span className="text-white/60 font-semibold">{maxHeartRate}bpm</span></span>
                  )}
                </p>
              )}
            </div>

            {/* Milestones — compact summary, full list one tap away */}
            {earnedMilestones.length > 0 && (
              <div className="mb-4">
                <button
                  onClick={() => setShowMilestones((v) => !v)}
                  aria-expanded={showMilestones}
                  className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 transition-colors hover:bg-white/[0.06]"
                >
                  <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-400/80">
                    <Trophy className="w-3.5 h-3.5" />
                    {earnedMilestones.length} Milestone{earnedMilestones.length > 1 ? "s" : ""} Earned
                  </span>
                  <span className="flex items-center gap-2">
                    {MILESTONE_TIER_ORDER.filter((t) => tierCounts[t]).map((t) => (
                      <span key={t} className="text-[11px] text-white/60 tabular-nums">
                        {MILESTONE_TIERS[t].icon}
                        <span className="ml-0.5">{tierCounts[t]}</span>
                      </span>
                    ))}
                    <span className={`text-white/60 transition-transform ${showMilestones ? "rotate-180" : ""}`}>▾</span>
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {showMilestones && (
                    <m.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
                        {sortedMilestones.map((milestone, idx) => (
                          <m.div
                            key={milestone.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex items-center gap-3 rounded-xl border px-3 py-2"
                            style={{
                              borderColor: MILESTONE_TIERS[milestone.tier].borderColor,
                              backgroundColor: MILESTONE_TIERS[milestone.tier].bgColor,
                            }}
                          >
                            <span className="text-xl">{MILESTONE_TIERS[milestone.tier].icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-white">{milestone.title}</p>
                              <p className="text-[10px] text-white/60 truncate">{milestone.description}</p>
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: MILESTONE_TIERS[milestone.tier].color }}>
                              {MILESTONE_TIERS[milestone.tier].label}
                            </span>
                          </m.div>
                        ))}
                      </div>
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Streak / SPIN / saved — chips, not boxes */}
            {(currentStreak > 0 || !isPracticeMode || walrusAnchorInfo) && (
              <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
                {currentStreak > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1.5 text-[11px] font-bold text-orange-300">
                    <Flame className="w-3.5 h-3.5" />
                    {currentStreak}-day streak
                  </span>
                )}
                {!isPracticeMode && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-300 tabular-nums">
                    <Star className="w-3.5 h-3.5" />
                    {spinEarned} SPIN earned
                  </span>
                )}
                {walrusAnchorInfo && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Ride saved
                  </span>
                )}
              </div>
            )}

          {/* Comparison + next-ride advice — live classes only. Practice
              completion leads with flow / milestones / share instead. */}
          {!isPracticeMode && (
          <details className="group mb-4 rounded-xl border border-white/10 bg-white/[0.03]">
            <summary className="flex cursor-pointer select-none items-center justify-between px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/60 transition-colors hover:text-white/60 [&::-webkit-details-marker]:hidden">
              <span>Comparison &amp; next ride</span>
              <span className="transition-transform group-open:rotate-180">▾</span>
            </summary>
            <div className="px-4 pb-4 pt-1">
              <RideComparison
                currentRideId={completedRideId}
                classId={classId}
                avgEffort={avgEffort}
                avgPower={avgPower}
                avgHeartRate={avgHeartRate}
                durationSec={elapsedTime}
                spinEarned={spinEarned}
              />

              {/* Next ride recommendation */}
              <div className="mt-4 pt-3 border-t border-white/5">
                <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold mb-1">
                  Next Ride
                </p>
                <p className="text-xs text-white/50 leading-relaxed">
                  {avgEffort >= 800
                    ? "You crushed it! Try a higher-intensity class to push your threshold further."
                    : avgEffort >= 500
                      ? "Solid effort. Aim for above 700 effort next ride for higher SPIN rewards."
                      : "Great start! An endurance class will help you build your base over time."}
                </p>
              </div>
            </div>
          </details>
          )}

          {/* Infra details — live classes only (practice stays rider-facing) */}
          {!isPracticeMode && (
            <StorageDetails
              walrusAnchorInfo={walrusAnchorInfo}
              syncStatus={walrusAnchorInfo ? "anchored" : "pending"}
              settlementStatus={settlementStatus}
              agentName={agentName}
              rating={rating}
              isSubmitted={isSubmitted}
              onSetRating={setRating}
              onSubmitRating={() => {
                setIsSubmitted(true);
              }}
            />
          )}
          </div>
        </m.div>
      )}

      {/* ─── Phase 3: ACTIONS (persistent bottom bar) ──────────────
          pointer-events pass through the wrapper so the stats column can
          scroll beneath the bar; each control re-enables its own events. */}
      {completionPhase !== "celebration" && (
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="absolute bottom-4 left-4 right-4 flex flex-col gap-2 pointer-events-none [&>*]:pointer-events-auto"
        >
          {/* Primary actions — practice: Ride Again + Done; live: history + again */}
          <div className="flex gap-2">
            {isPracticeMode ? (
              <>
                {onRideAgain && (
                  <button
                    onClick={onRideAgain}
                    className="flex-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 py-3 text-sm font-semibold text-black shadow-lg shadow-amber-500/40 transition-all active:scale-95"
                  >
                    Ride Again
                  </button>
                )}
                <button
                  onClick={onExit}
                  className="flex-1 rounded-full border border-white/20 bg-white/10 py-3 text-sm font-semibold text-white transition-all active:scale-95 hover:bg-white/20"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onExit}
                  className={
                    primaryAction === "view_history"
                      ? "flex-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/40 transition-all active:scale-95"
                      : "flex-1 rounded-full border border-white/20 bg-white/10 py-3 text-sm font-semibold text-white transition-all active:scale-95 hover:bg-white/20"
                  }
                >
                  View History
                </button>
                {onRideAgain && (
                  <button
                    onClick={onRideAgain}
                    className="flex-1 rounded-full border border-amber-400/40 bg-amber-400/10 py-3 text-sm font-semibold text-amber-200 transition-all active:scale-95 hover:bg-amber-400/20"
                  >
                    Ride Again
                  </button>
                )}
              </>
            )}
          </div>

          {/* Share — always available; practice completion leads with it. */}
          <div className="flex items-center justify-center gap-2">
            <ShareCardButton
              effortScore={avgEffort}
              avgPower={avgPower}
              avgHeartRate={avgHeartRate}
              durationSec={displayElapsed}
              spinEarned={isPracticeMode ? "0" : spinEarned}
              agentName={agentName}
              walrusBlobId={!isPracticeMode ? walrusAnchorInfo?.blobId : undefined}
            />
            {onExportTCX && !isPracticeMode && (
              <button
                onClick={onExportTCX}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-300 transition-all active:scale-95 hover:bg-amber-400/20"
              >
                Export TCX
              </button>
            )}
          </div>

          {/* Practice: soft wallet invite (not claim/infra chrome).
              Live: claim / wallet conversion as before. */}
          {isPracticeMode && !walletConnected && onConnectWallet ? (
            <button
              onClick={onConnectWallet}
              className="w-full rounded-full border border-white/15 bg-white/5 py-2.5 text-xs font-semibold text-white/70 transition-all active:scale-95 hover:bg-white/10 hover:text-white"
            >
              Keep your rides — connect when you&apos;re ready
            </button>
          ) : (
            !isPracticeMode &&
            ((onClaimRewards) || (!walletConnected && onConnectWallet)) && (
              <ClaimRewardsButton
                walletConnected={walletConnected}
                rewardClaimStatus={rewardClaimStatus}
                spinEarned={spinEarned}
                agentName={agentName}
                onClick={walletConnected ? onClaimRewards : onConnectWallet}
                onConnectWallet={onConnectWallet}
              />
            )
          )}
        </m.div>
      )}
    </m.div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function InlineStat({
  value,
  unit,
  highlight = false,
}: {
  value: string | number;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <span className={`whitespace-nowrap text-xl font-black tabular-nums tracking-tight ${highlight ? "text-amber-300" : "text-white"}`}>
      {value}
      {unit && <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-white/60">{unit}</span>}
    </span>
  );
}

function StorageDetails({
  walrusAnchorInfo,
  syncStatus,
  settlementStatus,
  agentName,
  rating,
  isSubmitted,
  onSetRating,
  onSubmitRating,
}: {
  walrusAnchorInfo: { blobId: string; txDigest?: string } | null;
  syncStatus: string;
  settlementStatus?: string;
  agentName: string;
  rating: number;
  isSubmitted: boolean;
  onSetRating: (r: number) => void;
  onSubmitRating: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  if (!walrusAnchorInfo && !settlementStatus) return null;

  return (
    <div className="mt-4 border-t border-white/5 pt-3">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-2 text-[10px] text-white/60 hover:text-white/50 transition-colors w-full"
      >
        <svg className={`w-3 h-3 transition-transform ${showDetails ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <span>Details</span>
      </button>

      <AnimatePresence>
        {showDetails && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Ride data saved */}
            {walrusAnchorInfo && (
              <div className="mt-2 flex items-center gap-2 text-[10px] text-emerald-400/60">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Ride data saved</span>
              </div>
            )}

            {/* Settlement status */}
            {settlementStatus && settlementStatus !== "skipped" && (
              <div className="mt-2 flex items-center gap-2 text-[10px] text-white/60">
                <span>Settlement: </span>
                {settlementStatus === "confirmed" && <span className="text-emerald-400">Confirmed</span>}
                {settlementStatus === "pending" && <span className="text-amber-400">Pending</span>}
                {settlementStatus === "failed" && <span className="text-rose-400">Failed</span>}
              </div>
            )}

            {/* Coach rating */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] text-white/60">Rate coaching:</span>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => onSetRating(star)}
                  className={`text-sm transition-colors ${rating >= star ? "text-amber-400" : "text-white/10"}`}
                >
                  ★
                </button>
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ClaimRewardsButton({
  walletConnected,
  rewardClaimStatus,
  spinEarned,
  agentName,
  onClick,
  onConnectWallet,
}: {
  walletConnected: boolean;
  rewardClaimStatus?: {
    mode: string;
    phase: string;
    privacyScore: number;
    privacyLevel: string;
    verifiedScore?: number;
    error: Error | null;
  };
  spinEarned: string;
  agentName: string;
  onClick?: () => void;
  onConnectWallet?: () => void;
}) {
  const isWalletConversion = !walletConnected && !!onConnectWallet;

  const claimButtonLabel = isWalletConversion
    ? "Connect Wallet to Claim"
    : !walletConnected
      ? "Connect Wallet to Claim"
      : rewardClaimStatus?.phase === "requesting"
        ? "Requesting Verification…"
        : rewardClaimStatus?.phase === "claimed"
          ? "✓ Rewards Claimed"
          : rewardClaimStatus?.phase === "ready"
            ? "Claim Verified Rewards"
            : "Claim your reward";

  // Disabled only mid-claim or after claiming. A disconnected wallet with a
  // connect handler available is an ACTIVE conversion CTA, not a dead button.
  const claimButtonDisabled =
    !isWalletConversion &&
    (!walletConnected ||
      rewardClaimStatus?.phase === "requested" ||
      rewardClaimStatus?.phase === "claiming" ||
      rewardClaimStatus?.phase === "claimed");

  if (isWalletConversion) {
    return (
      <button
        onClick={onClick}
        className="w-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 py-3 text-sm font-semibold text-black shadow-lg shadow-amber-500/40 transition-all active:scale-95"
      >
        {claimButtonLabel} · {spinEarned} SPIN
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={claimButtonDisabled}
      className="w-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 py-3 text-sm font-semibold text-black shadow-lg shadow-amber-500/30 transition-all active:scale-95 disabled:opacity-50"
    >
      {claimButtonLabel} · {spinEarned} SPIN
    </button>
  );
}
