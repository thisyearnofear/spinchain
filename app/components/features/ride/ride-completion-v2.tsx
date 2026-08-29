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
import { motion, AnimatePresence } from "framer-motion";
import { modalTransition } from "@/app/lib/motion";
import { formatTime } from "@/app/lib/formatters";
import { useCoachingStore } from "@/app/stores/coaching-store";
import { useTelemetryStore, selectEffort, selectPower, selectHeartRate } from "@/app/stores/telemetry-store";
import { useRideStore } from "@/app/stores/ride-store";
import { useRewardsStore } from "@/app/stores/rewards-store";
import { useSensoryStore } from "@/app/stores/sensory-store";
import {
  computePhaseTheme,
  phaseLabel,
  type IntervalPhase,
} from "@/app/lib/phase-theme";
import { Star, Cloud, CheckCircle2, Loader2, ShieldCheck, Zap, TrendingUp, Trophy, Flame } from "lucide-react";
import { milestonesAndStreaks, type SessionMilestone, MILESTONE_TIERS } from "@/app/lib/milestones";
import { ShareCardButton } from "./share-card";
import { RideComparison } from "./ride-comparison";
import { getEffortTier } from "@/app/lib/analytics/ride-history";
import { ANALYTICS_EVENTS, trackEvent } from "@/app/lib/analytics/events";

interface RideCompletionV2Props {
  isPracticeMode: boolean;
  walletConnected: boolean;
  elapsedTime: number;
  avgHeartRate: number;
  avgPower: number;
  avgEffort: number;
  telemetrySource: "live-bike" | "simulator" | "estimated";
  onExit: () => void;
  onRideAgain?: () => void;
  onShare?: () => void;
  onClaimRewards?: () => void;
  onExportTCX?: () => void;
  rewardClaimStatus?: {
    mode: "zk" | "chainlink";
    phase: string;
    privacyScore: number;
    privacyLevel: "high" | "medium" | "low";
    verifiedScore?: number;
    error: Error | null;
  };
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

export function RideCompletionV2({
  isPracticeMode,
  walletConnected,
  elapsedTime,
  avgHeartRate,
  avgPower,
  avgEffort,
  telemetrySource,
  onExit,
  onRideAgain,
  onShare,
  onClaimRewards,
  onExportTCX,
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
      return `A mindful ${formatTime(elapsedTime)} session. Your body sustained ${avgPower}W with a steady rhythm. ${effortTier === "elite" ? "Today you found your flow state." : "Each ride deepens your practice."} I've noted this for your journey.`;
    }

    return `Session analysis: ${formatTime(elapsedTime)} duration, ${avgPower}W avg power, ${avgHeartRate} BPM avg HR. ${hrEfficiency ? `Efficiency ratio: ${hrEfficiency}. ` : ""}Effort score ${avgEffort}/1000 (${effortTier}). ${effortTier === "elite" ? "Performance logged — recommending threshold increase." : `Target: push above ${avgEffort < 500 ? 500 : 800} next ride for higher SPIN yield.`}`;
  }, [agentPersonality, avgPower, avgHeartRate, avgEffort, elapsedTime]);

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

  // Phase theme for accent color
  const theme = computePhaseTheme(null, avgEffort);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="absolute inset-0 flex items-center justify-center pointer-events-auto p-4 overflow-hidden"
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
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...modalTransition, delay: 0.1 }}
          className="relative w-full max-w-md flex flex-col items-center text-center"
        >
          {/* Celebration particles */}
          <motion.div
            className="absolute inset-0 overflow-hidden pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {celebrationParticles.map((p, i) => (
              <motion.div
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
          </motion.div>

          {/* Done text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <p className="text-[10px] uppercase tracking-[0.4em] text-amber-300/60 mb-2">
              Session Complete
            </p>
            <motion.h2
              className="text-5xl font-black text-white tracking-tighter"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 20 }}
            >
              DONE
            </motion.h2>
          </motion.div>

          {/* PR celebration */}
          <AnimatePresence>
            {prBeaten && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: 0.8, duration: 0.4 }}
                className="mt-4 flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 px-4 py-2"
              >
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-amber-300">New Personal Record!</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Duration + Phase */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 flex items-center gap-3 text-white/40"
          >
            <span className="text-xs">{formatTime(elapsedTime)}</span>
            <span>·</span>
            <span className="text-xs">{telemetrySource === "live-bike" ? "Live" : telemetrySource === "simulator" ? "Simulator" : "Estimated"}</span>
          </motion.div>

          {/* Agent debrief */}
          <motion.div
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
          </motion.div>
        </motion.div>
      )}

      {/* ─── Phase 2: STATS ──────────────────────────────────────── */}
      {completionPhase === "stats" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative w-full max-w-lg flex flex-col"
        >
          {/* Header */}
          <div className="mb-6 text-center">
            <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/60 mb-1">
              Performance Debrief
            </p>
            <h2
              id="completion-title"
              className="text-xl font-bold text-white tracking-tight"
            >
              {agentName}&apos;s Notes
            </h2>
          </div>

          {/* Ride data saved confirmation */}
          {walrusAnchorInfo && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Your ride data saved ✓</span>
              </div>
            </motion.div>
          )}

          {/* Agent debrief */}
          <div className="relative pl-4 border-l-2 border-amber-400/40 mb-4">
            <p className="text-xs leading-relaxed text-white/70 italic">
              &ldquo;{getAgentDebrief()}&rdquo;
            </p>
          </div>

          {/* Stats grid — clean, minimal, no cards */}
          <div className="grid grid-cols-4 gap-4 mb-4 py-3 border-y border-white/5">
            <StatItem label="Avg HR" value={avgHeartRate} unit="bpm" />
            <StatItem label="Avg Power" value={avgPower} unit="W" />
            <StatItem label="Effort" value={avgEffort} unit="/1000" highlight />
            <StatItem label="Duration" value={formatTime(elapsedTime)} unit="" />
          </div>

          {/* Max stats */}
          {(maxPower > avgPower || maxHeartRate > avgHeartRate) && (
            <div className="grid grid-cols-2 gap-4 mb-4 py-2 border-b border-white/5">
              {maxPower > avgPower && (
                <div className="flex items-center gap-2 text-[11px] text-white/50">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Peak Power: <span className="text-white font-bold">{maxPower}W</span></span>
                </div>
              )}
              {maxHeartRate > avgHeartRate && (
                <div className="flex items-center gap-2 text-[11px] text-white/50">
                  <Zap className="w-3.5 h-3.5 text-rose-400" />
                  <span>Peak HR: <span className="text-white font-bold">{maxHeartRate}bpm</span></span>
                </div>
              )}
            </div>
          )}

          {/* Milestones — earned during this ride */}
          {earnedMilestones.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-amber-400" />
                <p className="text-[10px] uppercase tracking-widest text-amber-400/60 font-bold">
                  {earnedMilestones.length} Milestone{earnedMilestones.length > 1 ? 's' : ''} Earned
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {earnedMilestones.map((milestone, idx) => (
                  <motion.div
                    key={milestone.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + idx * 0.1 }}
                    className="flex items-center gap-3 rounded-xl border p-3"
                    style={{
                      borderColor: MILESTONE_TIERS[milestone.tier].borderColor,
                      backgroundColor: MILESTONE_TIERS[milestone.tier].bgColor,
                    }}
                  >
                    <span className="text-2xl">{MILESTONE_TIERS[milestone.tier].icon}</span>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-white">{milestone.title}</p>
                      <p className="text-[10px] text-white/40">{milestone.description}</p>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: MILESTONE_TIERS[milestone.tier].color }}>
                      {MILESTONE_TIERS[milestone.tier].label}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Streak indicator — always shown if user has streak */}
          {currentStreak > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="mb-4 flex items-center justify-center gap-3 rounded-xl bg-orange-500/5 border border-orange-500/20 px-4 py-3"
            >
              <Flame className="w-5 h-5 text-orange-400" />
              <div className="text-left">
                <p className="text-[9px] uppercase tracking-widest text-orange-400/60 font-bold">Current Streak</p>
                <p className="text-xl font-black text-orange-300 tabular-nums">{currentStreak} Day{currentStreak > 1 ? 's' : ''}</p>
              </div>
            </motion.div>
          )}

          {/* SPIN earned — prominent */}
          {!isPracticeMode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center justify-center gap-3 rounded-xl bg-amber-500/5 border border-amber-500/20 px-4 py-3 mb-4"
            >
              <span className="text-lg">💰</span>
              <div className="text-left">
                <p className="text-[9px] uppercase tracking-widest text-amber-400/60 font-bold">SPIN Earned</p>
                <p className="text-xl font-black text-amber-300 tabular-nums">{spinEarned} SPIN</p>
              </div>
            </motion.div>
          )}

          {/* Share card */}
          {onShare && (
            <div className="flex justify-center mb-4">
              <ShareCardButton
                effortScore={avgEffort}
                avgPower={avgPower}
                avgHeartRate={avgHeartRate}
                durationSec={elapsedTime}
                spinEarned={spinEarned}
                agentName={agentName}
                walrusBlobId={walrusAnchorInfo?.blobId}
              />
            </div>
          )}

          {/* Comparison + next-ride advice — collapsed by default so the
              stats phase leads with one decision (SPIN + debrief + actions),
              not eight competing ones. */}
          <details className="group mb-4 rounded-xl border border-white/10 bg-white/[0.03]">
            <summary className="flex cursor-pointer select-none items-center justify-between px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/40 transition-colors hover:text-white/60 [&::-webkit-details-marker]:hidden">
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
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">
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

          {/* Storage/Walrus info — collapsed by default */}
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
        </motion.div>
      )}

      {/* ─── Phase 3: ACTIONS (persistent bottom bar) ────────────── */}
      {completionPhase !== "celebration" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="absolute bottom-4 left-4 right-4 flex flex-col gap-2"
        >
          {/* Primary actions */}
          <div className="flex gap-2">
            {primaryAction === "view_history" ? (
              <button
                onClick={onExit}
                className="flex-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/40 transition-all active:scale-95"
              >
                View History
              </button>
            ) : (
              <button
                onClick={onExit}
                className="flex-1 rounded-full border border-white/20 bg-white/10 py-3 text-sm font-semibold text-white transition-all active:scale-95 hover:bg-white/20"
              >
                View History
              </button>
            )}

            {onRideAgain && (
              <button
                onClick={onRideAgain}
                className="flex-1 rounded-full border border-amber-400/40 bg-amber-400/10 py-3 text-sm font-semibold text-amber-200 transition-all active:scale-95 hover:bg-amber-400/20"
              >
                Ride Again
              </button>
            )}
          </div>

          {/* Claim rewards */}
          {!isPracticeMode && onClaimRewards && (
            <ClaimRewardsButton
              walletConnected={walletConnected}
              rewardClaimStatus={rewardClaimStatus}
              spinEarned={spinEarned}
              agentName={agentName}
              onClick={onClaimRewards}
            />
          )}

          {/* Export TCX */}
          {onExportTCX && (
            <button
              onClick={onExportTCX}
              className="w-full rounded-full border border-amber-400/30 bg-amber-400/10 py-2.5 text-xs font-medium text-amber-300 transition-all active:scale-95 hover:bg-amber-400/20"
            >
              Export TCX
            </button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function StatItem({
  label,
  value,
  unit,
  highlight = false,
}: {
  label: string;
  value: string | number;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-[9px] uppercase tracking-widest text-white/30 mb-0.5">{label}</p>
      <p className={`text-xl font-black tabular-nums tracking-tighter ${highlight ? "text-amber-300" : "text-white"}`}>
        {value}
        {unit && <span className="text-[10px] text-white/20 ml-1">{unit}</span>}
      </p>
    </div>
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
        className="flex items-center gap-2 text-[10px] text-white/30 hover:text-white/50 transition-colors w-full"
      >
        <svg className={`w-3 h-3 transition-transform ${showDetails ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <span>Details</span>
      </button>

      <AnimatePresence>
        {showDetails && (
          <motion.div
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
              <div className="mt-2 flex items-center gap-2 text-[10px] text-white/40">
                <span>Settlement: </span>
                {settlementStatus === "confirmed" && <span className="text-emerald-400">Confirmed</span>}
                {settlementStatus === "pending" && <span className="text-amber-400">Pending</span>}
                {settlementStatus === "failed" && <span className="text-rose-400">Failed</span>}
              </div>
            )}

            {/* Coach rating */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] text-white/30">Rate coaching:</span>
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
          </motion.div>
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
  onClick: () => void;
}) {
  const claimButtonLabel = !walletConnected
    ? "Connect Wallet to Claim"
    : rewardClaimStatus?.phase === "requesting"
      ? "Requesting Verification…"
      : rewardClaimStatus?.phase === "claimed"
        ? "✓ Rewards Claimed"
        : rewardClaimStatus?.phase === "ready"
          ? "Claim Verified Rewards"
          : "Claim your reward";

  const claimButtonDisabled =
    !walletConnected ||
    rewardClaimStatus?.phase === "requested" ||
    rewardClaimStatus?.phase === "claiming" ||
    rewardClaimStatus?.phase === "claimed";

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
