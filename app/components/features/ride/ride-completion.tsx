"use client";

/**
 * RideCompletion - Post-ride summary and actions
 *
 * Core Principles:
 * - MODULAR: Self-contained completion screen
 * - ACCESSIBLE: Focus management for modal
 * - CLEAN: Props-based, no external dependencies
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { formatTime } from "@/app/lib/formatters";
import { ANALYTICS_EVENTS, trackEvent } from "@/app/lib/analytics/events";
import { getEffortTier } from "@/app/lib/analytics/ride-history";
import { WALRUS_AGGREGATOR_URL } from "@/app/lib/walrus/types";
import { Star, Cloud, CheckCircle2, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { LoadingButton } from "../../ui/loading-button";
import { ShareCardButton } from "./share-card";
import { RideComparison, SegmentBreakdown } from "./ride-comparison";

export interface RewardClaimStatus {
  mode: "zk" | "chainlink";
  phase:
    | "idle"
    | "requesting"
    | "requested"
    | "ready"
    | "claiming"
    | "claimed"
    | "error";
  privacyScore: number;
  privacyLevel: "high" | "medium" | "low";
  verifiedScore?: number;
  error: Error | null;
}

interface RideCompletionProps {
  isPracticeMode: boolean;
  elapsedTime: number;
  avgHeartRate: number;
  avgPower: number;
  avgEffort: number;
  telemetrySource: "live-bike" | "simulator" | "estimated";
  onExit: () => void;
  onRideAgain?: () => void;
  onShare?: () => void;
  onDeploy?: () => void;
  onUpgrade?: () => void;
  onClaimRewards?: () => void;
  onExportTCX?: () => void;
  rewardClaimStatus?: RewardClaimStatus;
  spinEarned?: string;
  agentName?: string;
  agentPersonality?: "zen" | "drill-sergeant" | "data";
  syncStatus?: "local_only" | "queued" | "relayed" | "anchored" | "failed";
  primaryAction?: "view_history" | "ride_again";
  walrusAnchorInfo?: { blobId: string; txDigest?: string } | null;
  classId?: string;
  completedRideId?: string;
  settlementStatus?: "pending" | "confirmed" | "failed" | "skipped" | undefined;
}

type CompletionTab = "summary" | "rewards" | "storage";

export function RideCompletion({
  isPracticeMode,
  elapsedTime,
  avgHeartRate,
  avgPower,
  avgEffort,
  telemetrySource,
  onExit,
  onRideAgain,
  onShare,
  onDeploy,
  onUpgrade,
  onClaimRewards,
  onExportTCX,
  rewardClaimStatus,
  spinEarned = "0",
  agentName = "Coach",
  agentPersonality = "data",
  syncStatus = "local_only",
  primaryAction = "view_history",
  walrusAnchorInfo = null,
  classId,
  completedRideId,
  settlementStatus,
}: RideCompletionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<CompletionTab>("summary");
  const [rating, setRating] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const getAgentDebrief = useCallback(() => {
    const powerRating =
      avgPower > 250 ? "exceptional" : avgPower > 180 ? "solid" : "steady";
    const hrEfficiency =
      avgHeartRate > 0 && avgPower > 0
        ? (avgPower / avgHeartRate).toFixed(1)
        : null;
    const tierInfo = getEffortTier(avgEffort);
    const effortTier = tierInfo.label;

    if (agentPersonality === "drill-sergeant") {
      if (effortTier === "elite") {
        return `Outstanding work. ${powerRating.charAt(0).toUpperCase() + powerRating.slice(1)} power output at ${avgPower}W average. ${hrEfficiency ? `Power-to-HR ratio: ${hrEfficiency} — ` : ""}I've flagged this session for a threshold increase next time. You earned every token.`;
      }
      return `${avgPower}W average with ${avgEffort}/1000 effort. ${effortTier === "strong" ? "Not bad, but I know you have more." : "We're building your base. Next session, I'm pushing you harder."} ${hrEfficiency ? `Power-to-HR: ${hrEfficiency}.` : ""}`;
    }

    if (agentPersonality === "zen") {
      return `A mindful ${formatTime(elapsedTime)} session. Your body sustained ${avgPower}W with a ${powerRating} rhythm. ${hrEfficiency ? `Your efficiency ratio of ${hrEfficiency} shows balanced effort. ` : ""}${effortTier === "elite" ? "Today you found your flow state." : "Each ride deepens your practice."} I've noted this for your journey.`;
    }

    return `Session analysis: ${formatTime(elapsedTime)} duration, ${avgPower}W avg power, ${avgHeartRate} BPM avg HR. ${hrEfficiency ? `Power-to-HR efficiency: ${hrEfficiency}. ` : ""}Effort score ${avgEffort}/1000 (${effortTier}). ${effortTier === "elite" ? "Performance logged — recommending threshold increase for next session." : `Target: push effort above ${avgEffort < 500 ? 500 : 800} next ride for higher SPIN yield.`}`;
  }, [agentPersonality, avgPower, avgHeartRate, avgEffort, elapsedTime]);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isPracticeMode) {
      trackEvent(ANALYTICS_EVENTS.PREMIUM_UPSELL_VIEWED, {
        telemetrySource,
      });
    }
  }, [isPracticeMode, telemetrySource]);

  const claimButtonLabel =
    rewardClaimStatus?.phase === "requesting"
      ? "Requesting Verification…"
      : rewardClaimStatus?.phase === "requested"
        ? "✓ Verification Requested"
        : rewardClaimStatus?.phase === "ready"
          ? "Claim Verified Rewards"
          : rewardClaimStatus?.phase === "claiming"
            ? rewardClaimStatus.mode === "chainlink"
              ? "Claiming Rewards…"
              : "Submitting ZK Claim…"
            : rewardClaimStatus?.phase === "claimed"
              ? "✓ Rewards Claimed"
              : rewardClaimStatus?.mode === "chainlink"
                ? "Request Verification"
                : "Submit ZK Claim";

  const claimButtonDisabled =
    rewardClaimStatus?.phase === "requesting" ||
    rewardClaimStatus?.phase === "requested" ||
    rewardClaimStatus?.phase === "claiming" ||
    rewardClaimStatus?.phase === "claimed";

  const tabs: { id: CompletionTab; label: string }[] = [
    { id: "summary", label: "Summary" },
    ...(isPracticeMode ? [] : [{ id: "rewards" as CompletionTab, label: "Rewards" }]),
    { id: "storage", label: "Storage" },
  ];

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="absolute inset-0 flex items-center justify-center pointer-events-auto p-4 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-title"
      tabIndex={-1}
      style={{
        background: "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.15) 0%, rgba(7,9,15,0.98) 60%), #07090f",
      }}
    >
      {/* Atmospheric glow layers */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-purple-600/8 blur-[100px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className="relative w-full max-w-lg flex flex-col max-h-[90vh] text-center"
      >
        {/* Header */}
        <div className="mb-4 shrink-0">
          <div className="flex items-center justify-center gap-2 mb-2">
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.3 }}
              className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl sm:text-2xl shadow-lg shadow-indigo-500/30"
            >
              🧠
            </motion.div>
          </div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-indigo-300/70 mb-1">
            Performance Debrief
          </p>
          <h2
            id="completion-title"
            className="text-xl sm:text-2xl font-bold text-white mb-1 tracking-tight"
          >
            Message from {agentName}
          </h2>
          <p className="text-xs sm:text-sm text-white/50">
            {formatTime(elapsedTime)} session • {isPracticeMode ? "Practice" : "Live"} mode
          </p>
        </div>

        {/* Walrus + Sui anchor info — prominent, above tabs */}
        {walrusAnchorInfo && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="mb-4 shrink-0 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Anchored on Walrus + Sui</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={`${WALRUS_AGGREGATOR_URL}/v1/${walrusAnchorInfo.blobId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-indigo-300 hover:text-indigo-200 transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> View on Walrus
              </a>
              {walrusAnchorInfo.txDigest && (
                <a
                  href={`https://suiscan.xyz/testnet/tx/${walrusAnchorInfo.txDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-indigo-300 hover:text-indigo-200 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> View on SuiScan
                </a>
              )}
            </div>
            <p className="text-[8px] font-mono text-white/30 truncate mt-1.5 uppercase">Blob: {walrusAnchorInfo.blobId}</p>
          </motion.div>
        )}

        {/* Walrus pending state */}
        {!walrusAnchorInfo && (
          <div className="mb-4 shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Walrus upload pending</span>
            </div>
          </div>
        )}

        {/* Tab Bar — borderless, underline-style */}
        <div
          className="flex gap-6 mb-4 shrink-0 border-b border-white/10"
          role="tablist"
          aria-label="Ride completion sections"
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault();
                  const next = tabs[(index + 1) % tabs.length];
                  setActiveTab(next.id);
                  document.getElementById(`tab-${next.id}`)?.focus();
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const prev = tabs[(index - 1 + tabs.length) % tabs.length];
                  setActiveTab(prev.id);
                  document.getElementById(`tab-${prev.id}`)?.focus();
                } else if (e.key === "Home") {
                  e.preventDefault();
                  setActiveTab(tabs[0].id);
                  document.getElementById(`tab-${tabs[0].id}`)?.focus();
                } else if (e.key === "End") {
                  e.preventDefault();
                  const last = tabs[tabs.length - 1];
                  setActiveTab(last.id);
                  document.getElementById(`tab-${last.id}`)?.focus();
                }
              }}
              className={`flex-1 pb-2 text-xs sm:text-sm font-semibold transition-[color,border-color] duration-150 border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-indigo-400 text-white"
                  : "border-transparent text-white/50 hover:text-white/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content — scrollable */}
        <div
          className="overflow-y-auto flex-1 min-h-0 text-left"
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          id={`tabpanel-${activeTab}`}
          tabIndex={0}
        >
          {activeTab === "summary" && (
            <SummaryTab
              elapsedTime={elapsedTime}
              avgHeartRate={avgHeartRate}
              avgPower={avgPower}
              avgEffort={avgEffort}
              telemetrySource={telemetrySource}
              getAgentDebrief={getAgentDebrief}
              spinEarned={spinEarned}
              agentName={agentName}
              walrusAnchorInfo={walrusAnchorInfo}
              classId={classId}
              completedRideId={completedRideId}
            />
          )}
          {activeTab === "rewards" && (
            <RewardsTab
              isPracticeMode={isPracticeMode}
              elapsedTime={elapsedTime}
              avgEffort={avgEffort}
              spinEarned={spinEarned}
              agentName={agentName}
              rewardClaimStatus={rewardClaimStatus}
              onUpgrade={onUpgrade}
            />
          )}
          {activeTab === "storage" && (
            <StorageTab
              agentName={agentName}
              rating={rating}
              isSubmitted={isSubmitted}
              walrusAnchorInfo={walrusAnchorInfo}
              syncStatus={syncStatus}
              settlementStatus={settlementStatus}
              onSetRating={setRating}
              onSubmitRating={() => {
                setIsSubmitted(true);
                localStorage.setItem(`coach_rating_${agentName}`, String(rating));
              }}
            />
          )}
        </div>

        {/* Action Buttons — persistent */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-3 shrink-0">
          {primaryAction === "view_history" ? (
            <button
              onClick={onExit}
              className="flex-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 py-2.5 sm:py-3 text-sm sm:text-base text-white font-semibold shadow-lg shadow-indigo-500/50 transition-[transform,opacity] duration-150 active:scale-95 touch-manipulation min-h-[44px] sm:min-h-[52px] hover:opacity-90"
              aria-label={isPracticeMode ? "Back to builder" : "View history"}
            >
              {isPracticeMode ? "Back to Builder" : "View History"}
            </button>
          ) : (
            <button
              onClick={onExit}
              className="flex-1 rounded-full border border-white/20 bg-white/10 py-2.5 sm:py-3 text-sm sm:text-base text-white font-semibold transition-[transform,background-color] duration-150 active:scale-95 touch-manipulation min-h-[44px] sm:min-h-[52px] hover:bg-white/20"
              aria-label={isPracticeMode ? "Back to builder" : "View history"}
            >
              {isPracticeMode ? "Back to Builder" : "View History"}
            </button>
          )}

          {onRideAgain && (
            <button
              onClick={onRideAgain}
              className={`flex-1 rounded-full py-2.5 sm:py-3 text-sm sm:text-base font-semibold transition-[transform,background-color,opacity] duration-150 active:scale-95 touch-manipulation min-h-[44px] sm:min-h-[52px] ${
                primaryAction === "ride_again"
                  ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/40 hover:opacity-90"
                  : "border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
              }`}
              aria-label="Ride again"
            >
              Ride Again
            </button>
          )}

          {onShare && (
            <button
              onClick={onShare}
              className="flex-1 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 py-2.5 sm:py-3 text-sm sm:text-base text-fuchsia-200 font-semibold transition-[transform,background-color] duration-150 active:scale-95 touch-manipulation min-h-[44px] sm:min-h-[52px] hover:bg-fuchsia-500/20"
              aria-label="Share ride"
            >
              Share
            </button>
          )}

          {onExportTCX && (
            <button
              onClick={onExportTCX}
              className="flex-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 py-2.5 sm:py-3 text-sm sm:text-base text-indigo-300 font-semibold transition-[transform,background-color] duration-150 active:scale-95 touch-manipulation min-h-[44px] sm:min-h-[52px] hover:bg-indigo-500/20"
              aria-label="Export activity as TCX"
            >
              Export TCX
            </button>
          )}

          {isPracticeMode && onDeploy ? (
            <button
              onClick={onDeploy}
              className="flex-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 py-2.5 sm:py-3 text-sm sm:text-base text-white font-semibold shadow-lg shadow-indigo-500/50 transition-[transform,opacity] duration-150 active:scale-95 touch-manipulation min-h-[44px] sm:min-h-[52px] hover:opacity-90"
              aria-label="Deploy class"
            >
              Deploy Class
            </button>
          ) : !isPracticeMode && onClaimRewards ? (
            <button
              onClick={onClaimRewards}
              disabled={claimButtonDisabled}
              className="flex-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 py-2.5 sm:py-3 text-sm sm:text-base text-white font-semibold shadow-lg shadow-indigo-500/50 transition-[transform,opacity] duration-150 active:scale-95 touch-manipulation min-h-[44px] sm:min-h-[52px] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Request agent validation of rewards"
            >
              {claimButtonLabel}
            </button>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Summary Tab ─────────────────────────────────────────────────

function SummaryTab({
  elapsedTime,
  avgHeartRate,
  avgPower,
  avgEffort,
  telemetrySource,
  getAgentDebrief,
  spinEarned,
  agentName,
  walrusAnchorInfo,
  classId,
  completedRideId,
}: {
  elapsedTime: number;
  avgHeartRate: number;
  avgPower: number;
  avgEffort: number;
  telemetrySource: "live-bike" | "simulator" | "estimated";
  getAgentDebrief: () => string;
  spinEarned: string;
  agentName: string;
  walrusAnchorInfo: { blobId: string; txDigest?: string } | null;
  classId?: string;
  completedRideId?: string;
}) {
  return (
    <div className="space-y-4">
      {/* Agent Narrative — no card, just typography */}
      <div className="relative pl-4 border-l-2 border-indigo-400/40">
        <p className="text-xs sm:text-sm leading-relaxed text-white/70 italic">
          &ldquo;{getAgentDebrief()}&rdquo;
        </p>
      </div>

      {/* Telemetry Source — minimal pill */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 text-xs text-white/60">
          <span
            className={`h-2 w-2 rounded-full ${
              telemetrySource === "live-bike"
                ? "bg-emerald-400"
                : telemetrySource === "simulator"
                  ? "bg-amber-400"
                  : "bg-zinc-400"
            }`}
          />
          {telemetrySource === "live-bike"
            ? "Live bike telemetry"
            : telemetrySource === "simulator"
              ? "Simulator telemetry"
              : "Estimated telemetry"}
        </div>
      </div>

      {/* Stats — no card containers, pure typography */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 py-2">
        <Stat label="Avg HR" value={avgHeartRate} />
        <Stat label="Avg Power" value={`${avgPower}W`} />
        <Stat label="Effort" value={avgEffort} highlight />
      </div>

      {/* Next Ride Recommendation — no card, just accent text */}
      <div className="pt-2">
        <p className="text-[10px] uppercase tracking-widest text-cyan-400/70 font-bold mb-1.5">
          Next Ride
        </p>
        {avgEffort >= 800 ? (
          <p className="text-xs text-white/60 leading-relaxed">
            You crushed it! Ready for a bigger challenge? Try a higher-intensity class to push your threshold even further.
          </p>
        ) : avgEffort >= 500 ? (
          <p className="text-xs text-white/60 leading-relaxed">
            Solid effort. Next time, aim to push above 700 effort score to unlock higher SPIN rewards. An interval-focused class will help you get there.
          </p>
        ) : (
          <p className="text-xs text-white/60 leading-relaxed">
            Great start on your fitness journey! A steady endurance class will help you build your base and increase your effort score over time.
          </p>
        )}
      </div>
      {/* Share card */}
      <div className="flex justify-center pt-2">
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

      {/* Ride comparison vs previous ride on same route */}
      <RideComparison
        currentRideId={completedRideId}
        classId={classId}
        avgEffort={avgEffort}
        avgPower={avgPower}
        avgHeartRate={avgHeartRate}
        durationSec={elapsedTime}
        spinEarned={spinEarned}
      />

      {/* Zone-based segment breakdown */}
      <SegmentBreakdown
        durationSec={elapsedTime}
        avgEffort={avgEffort}
      />
    </div>
  );
}

// ─── Rewards Tab ─────────────────────────────────────────────────

function RewardsTab({
  isPracticeMode,
  elapsedTime,
  avgEffort,
  spinEarned,
  agentName,
  rewardClaimStatus,
  onUpgrade,
}: {
  isPracticeMode: boolean;
  elapsedTime: number;
  avgEffort: number;
  spinEarned: string;
  agentName: string;
  rewardClaimStatus?: RewardClaimStatus;
  onUpgrade?: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* SPIN Token Earnings — no card, accent label + content */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest text-amber-400/70 font-bold">SPIN Token Earnings</p>
          <span className="text-[10px] font-bold text-amber-300/60">{spinEarned} SPIN</span>
        </div>
        <p className="text-xs text-white/50 mb-2">Earn SPIN tokens based on your performance:</p>
        <ul className="text-xs text-white/50 space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-amber-400 mt-0.5">↗</span>
            <span>Effort Score ({avgEffort}/1000): Higher effort = more tokens</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400 mt-0.5">↗</span>
            <span>Duration ({formatTime(elapsedTime)}): Longer workouts = higher rewards</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400 mt-0.5">↗</span>
            <span>Consistency: Steady effort throughout = bonus tokens</span>
          </li>
        </ul>
        <p className="text-xs text-white/50 mt-2">Your {avgEffort} effort score earned you <span className="text-amber-400 font-bold">{spinEarned}</span> SPIN tokens.</p>
      </div>

      {/* Improvement Tips — no card, accent label + content */}
      <div className="pt-1 border-t border-white/5">
        <p className="text-[10px] uppercase tracking-widest text-emerald-400/70 font-bold mb-2 mt-3">Boost Your Earnings</p>
        <ul className="text-xs text-white/50 space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">↗</span>
            <span>Increase effort score: Push harder during intervals</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">↗</span>
            <span>Extend duration: Add 5-10 minutes to your workout</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">↗</span>
            <span>Maintain consistency: Keep effort above 700 throughout</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">↗</span>
            <span>Complete more classes: Regular workouts = bonus rewards</span>
          </li>
        </ul>
      </div>

      {/* Performance Context — no card, stat row */}
      <div className="pt-1 border-t border-white/5">
        <p className="text-[10px] uppercase tracking-widest text-blue-400/70 font-bold mb-2 mt-3">Your Performance</p>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Effort</p>
            <p className="text-lg font-black text-white tracking-tighter">{avgEffort}<span className="text-xs text-white/30">/1000</span></p>
          </div>
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Duration</p>
            <p className="text-lg font-black text-white tracking-tighter">{formatTime(elapsedTime)}</p>
          </div>
        </div>
        <p className="text-xs text-white/40">Aim for 900+ effort score to earn 50+ SPIN tokens!</p>
      </div>

      {/* Reward Verification Status */}
      {!isPracticeMode && rewardClaimStatus && (
        <RewardVerificationStatus
          agentName={agentName}
          spinEarned={spinEarned}
          rewardClaimStatus={rewardClaimStatus}
        />
      )}

      {/* Premium Upsell — no card, borderless */}
      {!isPracticeMode && (
        <div className="pt-1 border-t border-white/5">
          <div className="mt-3 mb-2">
            <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Free</p>
            <p className="text-xs text-white/50">Live telemetry + ride summary</p>
          </div>
          <div className="mb-2">
            <p className="text-[10px] uppercase tracking-widest text-indigo-400/70 font-bold">Premium</p>
            <p className="text-xs text-white/50">Historical trends, zone breakdowns, and AI coaching insights</p>
          </div>
          {onUpgrade && (
            <button
              onClick={() => {
                trackEvent(ANALYTICS_EVENTS.PREMIUM_UPSELL_CLICKED, { source: "ride-completion" });
                onUpgrade();
              }}
              className="text-xs font-semibold text-indigo-300 transition hover:text-indigo-200 underline underline-offset-4 decoration-indigo-400/30"
            >
              Unlock Advanced Analytics →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Reward Verification Status ──────────────────────────────────

function RewardVerificationStatus({
  agentName,
  spinEarned,
  rewardClaimStatus,
}: {
  agentName: string;
  spinEarned: string;
  rewardClaimStatus: RewardClaimStatus;
}) {
  return (
    <div className="pt-1 border-t border-white/5 text-xs">
      <div className="flex items-center justify-between mb-2 mt-3">
        <span className="font-semibold text-white flex items-center gap-1.5">
          <span className="text-sm">🧠</span>
          {rewardClaimStatus.mode === "chainlink" ? "Reward Verification" : "ZK Claim Validation"}
        </span>
        <span
          className={`text-[10px] font-bold ${
            rewardClaimStatus.mode === "chainlink"
              ? "text-cyan-400"
              : rewardClaimStatus.privacyLevel === "high"
              ? "text-emerald-400"
              : rewardClaimStatus.privacyLevel === "medium"
                ? "text-amber-400"
                : "text-zinc-400"
          }`}
        >
          {rewardClaimStatus.mode === "chainlink"
            ? "CHAINLINK VERIFIED"
            : `${rewardClaimStatus.privacyLevel.toUpperCase()} PRIVACY`}
        </span>
      </div>

      {(rewardClaimStatus.phase === "requesting" || rewardClaimStatus.phase === "claiming") && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="h-5 w-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
            <span className="text-indigo-300 font-medium">
              {rewardClaimStatus.mode === "chainlink"
                ? rewardClaimStatus.phase === "claiming"
                  ? `${agentName} is claiming your verified rewards…`
                  : `${agentName} is requesting biometric verification…`
                : `${agentName} is reviewing your session…`}
            </span>
          </div>
          <div className="space-y-1 text-white/50 pl-7">
            <p className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              {rewardClaimStatus.mode === "chainlink" ? "Submitting telemetry verification request" : "Verifying biometric integrity"}
            </p>
            <p className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-amber-400 animate-pulse" />
              {rewardClaimStatus.mode === "chainlink"
                ? rewardClaimStatus.phase === "claiming"
                  ? "Preparing on-chain reward claim"
                  : "Waiting for Chainlink CRE attestation"
                : "Computing effort score via ZK circuit"}
            </p>
            <p className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-white/20" />
              {rewardClaimStatus.mode === "chainlink" ? "Settling through IncentiveEngine" : "Submitting proof to IncentiveEngine"}
            </p>
          </div>
        </div>
      )}

      {rewardClaimStatus.phase === "requested" && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="h-5 w-5 rounded-full bg-cyan-500/20 flex items-center justify-center">
              <Cloud className="h-3 w-3 text-cyan-300" />
            </div>
            <span className="text-cyan-300 font-medium">
              Verification requested — claim will unlock after Chainlink CRE responds
            </span>
          </div>
          <p className="text-white/50 pl-7">
            Keep this ride open or revisit Journey to complete the claim once a verified score is available.
          </p>
        </div>
      )}

      {rewardClaimStatus.phase === "ready" && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="h-5 w-5 rounded-full bg-cyan-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-3 w-3 text-cyan-300" />
            </div>
            <span className="text-cyan-300 font-medium">
              Verification complete — rewards are ready to claim
            </span>
          </div>
          <p className="text-white/50 pl-7">Verified effort score: {rewardClaimStatus.verifiedScore ?? 0}/1000</p>
        </div>
      )}

      {rewardClaimStatus.phase === "claimed" && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg className="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-emerald-300 font-medium">
              {agentName} approved — {spinEarned} SPIN released
            </span>
          </div>
          <p className="text-white/50 pl-7">
            {rewardClaimStatus.mode === "chainlink"
              ? `Chainlink verification settled on-chain • Verified score: ${rewardClaimStatus.verifiedScore ?? 0}/1000`
              : `ZK proof verified on-chain • Privacy score: ${rewardClaimStatus.privacyScore}/100`}
          </p>
        </div>
      )}

      {rewardClaimStatus.phase === "error" && rewardClaimStatus.error && (
        <p className="text-red-300">
          {rewardClaimStatus.mode === "chainlink"
            ? `${agentName} verification request failed — retry the claim when you're back online.`
            : `${agentName} validation failed — retry the ZK claim.`}
        </p>
      )}

      {rewardClaimStatus.phase === "idle" && (
        <p className="text-white/50">
          {rewardClaimStatus.mode === "chainlink"
            ? `Request verification to have ${agentName} send your ride to Chainlink CRE for biometric validation before claiming rewards.`
            : `Submit your ride to have ${agentName} verify the session and settle your ZK reward claim on-chain.`}
        </p>
      )}
    </div>
  );
}

// ─── Storage Tab ─────────────────────────────────────────────────

function StorageTab({
  agentName,
  rating,
  isSubmitted,
  walrusAnchorInfo,
  syncStatus,
  settlementStatus,
  onSetRating,
  onSubmitRating,
}: {
  agentName: string;
  rating: number;
  isSubmitted: boolean;
  walrusAnchorInfo: { blobId: string; txDigest?: string } | null;
  syncStatus: string;
  settlementStatus?: "pending" | "confirmed" | "failed" | "skipped" | undefined;
  onSetRating: (r: number) => void;
  onSubmitRating: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Walrus Decentralized Journey — no card */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Decentralized Journey</span>
            <h4 className="text-sm font-bold text-white italic">Store Session on Walrus</h4>
          </div>
          <Cloud className="w-4 h-4 text-indigo-400" />
        </div>

        {walrusAnchorInfo && (
          <div className="space-y-3 mb-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Anchored to Walrus</span>
            </div>
            <div className="overflow-hidden">
              <p className="text-[8px] font-mono text-white/40 truncate uppercase">Blob ID: {walrusAnchorInfo.blobId}</p>
              {walrusAnchorInfo.txDigest && (
                <p className="text-[8px] font-mono text-white/40 truncate mt-1">Sui TX: {walrusAnchorInfo.txDigest}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <a
                href={`${WALRUS_AGGREGATOR_URL}/v1/${walrusAnchorInfo.blobId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-indigo-300 hover:text-indigo-200 transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> View on Walrus
              </a>
              {walrusAnchorInfo.txDigest && (
                <a
                  href={`https://suiscan.xyz/testnet/tx/${walrusAnchorInfo.txDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-indigo-300 hover:text-indigo-200 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> View on SuiScan
                </a>
              )}
            </div>
          </div>
        )}

        {!walrusAnchorInfo && (
          <div className="flex items-center gap-2 text-white/40">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Uploading to Walrus…</span>
          </div>
        )}
      </div>

      {/* Sync Status — no card, just text */}
      <div className="pt-1 border-t border-white/5">
        <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1 mt-3">Storage Sync</p>
        <p className="text-xs text-white/50">
          {syncStatus.replace("_", " ")}
          {syncStatus === "queued" ? " • queued for relay" : ""}
          {syncStatus === "relayed" ? " • relay acknowledged" : ""}
          {syncStatus === "anchored" ? " • on-chain commitment anchored" : ""}
          {syncStatus === "failed" ? " • retry from Journey when online" : ""}
        </p>
      </div>

      {/* Reward Settlement Status — separate from anchoring */}
      {settlementStatus && settlementStatus !== "skipped" && (
        <div className="pt-1 border-t border-white/5">
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1 mt-3">Reward Settlement</p>
          <div className="flex items-center gap-2">
            {settlementStatus === "confirmed" && (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-emerald-400 font-semibold">Confirmed on-chain</span>
              </>
            )}
            {settlementStatus === "pending" && (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                <span className="text-xs text-amber-400 font-semibold">Pending — awaiting confirmation</span>
              </>
            )}
            {settlementStatus === "failed" && (
              <>
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span className="text-xs text-rose-400 font-semibold">Failed — retry from Journey</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Coach Rating — no card */}
      <div className="pt-1 border-t border-white/5">
        <div className="flex items-center justify-between mb-3 mt-3">
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Protocol Governance</span>
            <h4 className="text-sm font-bold text-white">Rate {agentName}&apos;s Coaching</h4>
          </div>
          <Star className="w-4 h-4 text-indigo-400" />
        </div>

        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => onSetRating(star)}
              className={`flex-1 py-3 rounded-lg border transition-all ${
                rating >= star
                  ? "bg-indigo-600/20 border-indigo-500 text-indigo-400"
                  : "bg-transparent border-white/5 text-white/20 hover:border-white/10"
              }`}
            >
              <Star className={`w-5 h-5 mx-auto ${rating >= star ? "fill-current" : ""}`} />
            </button>
          ))}
        </div>

        {rating > 0 && (
          <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <p className="text-[10px] text-white/40 italic text-center">
              Your rating will influence {agentName}&apos;s future strategy weights in the protocol.
            </p>
            <LoadingButton
              variant="secondary"
              className="w-full mt-3 h-10 text-[10px] uppercase font-bold tracking-widest rounded-lg"
              onClick={onSubmitRating}
              isLoading={isSubmitted}
              loadingText="Voting on Protocol..."
            >
              {isSubmitted ? "Governance Vote Cast" : "Submit Feedback"}
            </LoadingButton>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-[10px] sm:text-xs text-white/40 uppercase tracking-widest mb-1">{label}</p>
      <p
        className={`text-2xl sm:text-4xl font-black tracking-tighter ${highlight ? "text-purple-400" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}
