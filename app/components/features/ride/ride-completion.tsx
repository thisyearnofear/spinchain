"use client";

/**
 * RideCompletion - Post-ride summary and actions
 *
 * Core Principles:
 * - MODULAR: Self-contained completion screen
 * - ACCESSIBLE: Focus management for modal
 * - CLEAN: Props-based, no external dependencies
 */

import { useEffect, useRef, useState } from "react";
import { formatTime } from "@/app/lib/formatters";
import { ANALYTICS_EVENTS, trackEvent } from "@/app/lib/analytics/events";
import { Star, Cloud, Share2, CheckCircle2 } from "lucide-react";
import { LoadingButton } from "../../ui/loading-button";
import { WalrusClient } from "@/app/lib/walrus/client";

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
}

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
}: RideCompletionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rating, setRating] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isPersisting, setIsPersisting] = useState(false);
  const [walrusId, setWalrusId] = useState<string | null>(null);

  const handlePersistToWalrus = async () => {
    setIsPersisting(true);
    try {
      const walrus = new WalrusClient();
      const summary = {
        timestamp: Date.now(),
        duration: elapsedTime,
        avgPower,
        avgHr: avgHeartRate,
        effort: avgEffort,
        agent: agentName,
        debrief: getAgentDebrief(),
      };
      const result = await walrus.store(
        JSON.stringify(summary),
        "application/json",
      );
      if (result.success && result.blobId) {
        setWalrusId(result.blobId);
        trackEvent(ANALYTICS_EVENTS.RIDE_SYNC_SUCCESS, {
          blobId: result.blobId,
        });
      }
    } catch (err) {
      console.error("Walrus persist failed:", err);
    } finally {
      setIsPersisting(false);
    }
  };

  // Auto-focus for accessibility
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

  const getAgentDebrief = () => {
    const powerRating =
      avgPower > 250 ? "exceptional" : avgPower > 180 ? "solid" : "steady";
    const hrEfficiency =
      avgHeartRate > 0 && avgPower > 0
        ? (avgPower / avgHeartRate).toFixed(1)
        : null;
    const effortTier =
      avgEffort >= 800 ? "elite" : avgEffort >= 500 ? "strong" : "building";

    if (agentPersonality === "drill-sergeant") {
      if (effortTier === "elite") {
        return `Outstanding work. ${powerRating.charAt(0).toUpperCase() + powerRating.slice(1)} power output at ${avgPower}W average. ${hrEfficiency ? `Power-to-HR ratio: ${hrEfficiency} — ` : ""}I've flagged this session for a threshold increase next time. You earned every token.`;
      }
      return `${avgPower}W average with ${avgEffort}/1000 effort. ${effortTier === "strong" ? "Not bad, but I know you have more." : "We're building your base. Next session, I'm pushing you harder."} ${hrEfficiency ? `Power-to-HR: ${hrEfficiency}.` : ""}`;
    }

    if (agentPersonality === "zen") {
      return `A mindful ${formatTime(elapsedTime)} session. Your body sustained ${avgPower}W with a ${powerRating} rhythm. ${hrEfficiency ? `Your efficiency ratio of ${hrEfficiency} shows balanced effort. ` : ""}${effortTier === "elite" ? "Today you found your flow state." : "Each ride deepens your practice."} I've noted this for your journey.`;
    }

    // data personality (default)
    return `Session analysis: ${formatTime(elapsedTime)} duration, ${avgPower}W avg power, ${avgHeartRate} BPM avg HR. ${hrEfficiency ? `Power-to-HR efficiency: ${hrEfficiency}. ` : ""}Effort score ${avgEffort}/1000 (${effortTier}). ${effortTier === "elite" ? "Performance logged — recommending threshold increase for next session." : `Target: push effort above ${avgEffort < 500 ? 500 : 800} next ride for higher SPIN yield.`}`;
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center pointer-events-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-title"
      tabIndex={-1}
    >
      <div className="rounded-3xl bg-gradient-to-br from-indigo-900/90 to-purple-900/90 border border-white/20 p-4 sm:p-8 text-center max-w-lg w-full backdrop-blur-xl overflow-y-auto max-h-[90vh]">
        {/* Agent Debrief Header */}
        <div className="mb-4">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl sm:text-2xl">
              🧠
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-indigo-300/70 mb-1">
            Performance Debrief
          </p>
          <h2
            id="completion-title"
            className="text-xl sm:text-2xl font-bold text-white mb-1"
          >
            Message from {agentName}
          </h2>
          <p className="text-xs sm:text-sm text-white/50 mb-3">
            {formatTime(elapsedTime)} session •{" "}
            {isPracticeMode ? "Practice" : "Live"} mode
          </p>
        </div>

        {/* Agent Narrative */}
        <div className="mb-4 rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-3 sm:p-4 text-left">
          <p className="text-xs sm:text-sm leading-relaxed text-white/80 italic">
            &ldquo;{getAgentDebrief()}&rdquo;
          </p>
        </div>

        {/* SPIN Token Explanation */}
        <div className="mb-4 rounded-xl border border-white/15 bg-black/20 p-3 text-left text-xs text-white/80">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-white">
              🎉 SPIN Token Earnings
            </span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-500/30 text-amber-300">
              How It Works
            </span>
          </div>
          <p className="text-white/60 mb-2">
            Earn SPIN tokens based on your performance:
          </p>
          <ul className="text-white/60 space-y-1 pl-4">
            <li className="flex items-start gap-2">
              <svg
                className="h-4 w-4 text-amber-400 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
              <span>
                Effort Score ({avgEffort}/1000): Higher effort = more tokens
              </span>
            </li>
            <li className="flex items-start gap-2">
              <svg
                className="h-4 w-4 text-amber-400 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
              <span>
                Duration ({formatTime(elapsedTime)}): Longer workouts = higher
                rewards
              </span>
            </li>
            <li className="flex items-start gap-2">
              <svg
                className="h-4 w-4 text-amber-400 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
              <span>Consistency: Steady effort throughout = bonus tokens</span>
            </li>
          </ul>
          <p className="text-white/60 mt-2">
            Your {avgEffort} effort score earned you {spinEarned} SPIN tokens.
          </p>
        </div>

        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/80">
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
            ? "Telemetry source: Live bike"
            : telemetrySource === "simulator"
              ? "Telemetry source: Simulator"
              : "Telemetry source: Estimated"}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
          <Stat label="Avg HR" value={avgHeartRate} />
          <Stat label="Avg Power" value={`${avgPower}W`} />
          <Stat label="Effort" value={avgEffort} highlight />
        </div>

        {/* Improvement Tips */}
        <div className="mb-4 rounded-xl border border-white/15 bg-black/20 p-3 text-left text-xs text-white/80">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-white">
              🚀 Boost Your Earnings
            </span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-green-500/30 text-green-300">
              Next Time
            </span>
          </div>
          <p className="text-white/60 mb-2">
            Improve your SPIN earnings with these tips:
          </p>
          <ul className="text-white/60 space-y-1 pl-4">
            <li className="flex items-start gap-2">
              <svg
                className="h-4 w-4 text-green-400 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
              <span>Increase effort score: Push harder during intervals</span>
            </li>
            <li className="flex items-start gap-2">
              <svg
                className="h-4 w-4 text-green-400 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
              <span>Extend duration: Add 5-10 minutes to your workout</span>
            </li>
            <li className="flex items-start gap-2">
              <svg
                className="h-4 w-4 text-green-400 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
              <span>
                Maintain consistency: Keep effort above 700 throughout
              </span>
            </li>
            <li className="flex items-start gap-2">
              <svg
                className="h-4 w-4 text-green-400 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
              <span>
                Complete more classes: Regular workouts = bonus rewards
              </span>
            </li>
          </ul>
        </div>

        {/* Protocol Governance: Coach Rating */}
        <div className="rounded-3xl bg-indigo-500/5 border border-indigo-500/10 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">
                Protocol Governance
              </span>
              <h4 className="text-sm font-bold text-white">
                Rate {agentName}&apos;s Coaching
              </h4>
            </div>
            <Star className="w-4 h-4 text-indigo-400" />
          </div>

          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`flex-1 py-3 rounded-xl border transition-all ${
                  rating >= star
                    ? "bg-indigo-600/20 border-indigo-500 text-indigo-400"
                    : "bg-white/5 border-white/5 text-white/20 hover:border-white/10"
                }`}
              >
                <Star
                  className={`w-5 h-5 mx-auto ${rating >= star ? "fill-current" : ""}`}
                />
              </button>
            ))}
          </div>

          {rating > 0 && (
            <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <p className="text-[10px] text-white/40 italic text-center">
                Your rating will influence {agentName}&apos;s future strategy
                weights in the protocol.
              </p>
              <LoadingButton
                variant="secondary"
                className="w-full mt-3 h-10 text-[10px] uppercase font-black tracking-widest rounded-xl"
                onClick={() => {
                  setIsSubmitted(true);
                  localStorage.setItem(
                    `coach_rating_${agentName}`,
                    String(rating),
                  );
                }}
                isLoading={isSubmitted}
                loadingText="Voting on Protocol..."
              >
                {isSubmitted ? "Governance Vote Cast" : "Submit Feedback"}
              </LoadingButton>
            </div>
          )}
        </div>

        {/* Walrus Decentralized Journey */}
        <div className="rounded-3xl bg-white/5 border border-white/10 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Decentralized Journey</span>
              <h4 className="text-sm font-bold text-white italic">Store Session on Walrus</h4>
            </div>
            <Cloud className="w-4 h-4 text-indigo-400" />
          </div>
          
          {!walrusId ? (
            <LoadingButton
              variant="secondary"
              className="w-full h-12 rounded-2xl gap-2 font-black uppercase tracking-widest text-[10px]"
              onClick={handlePersistToWalrus}
              isLoading={isPersisting}
              loadingText="Uploading to Walrus..."
            >
              <Share2 className="w-3.5 h-3.5" />
              Persist Forever
            </LoadingButton>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Anchored to Walrus</span>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 overflow-hidden">
                <p className="text-[8px] font-mono text-white/30 truncate uppercase">Blob ID: {walrusId}</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          {primaryAction === "view_history" ? (
            <button
              onClick={onExit}
              className="flex-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 py-2.5 sm:py-3 text-sm sm:text-base text-white font-semibold shadow-lg shadow-indigo-500/50 transition-all active:scale-95 touch-manipulation min-h-[44px] sm:min-h-[52px] hover:opacity-90"
              aria-label={isPracticeMode ? "Back to builder" : "View history"}
            >
              {isPracticeMode ? "Back to Builder" : "View History"}
            </button>
          ) : (
            <button
              onClick={onExit}
              className="flex-1 rounded-full border border-white/20 bg-white/10 py-2.5 sm:py-3 text-sm sm:text-base text-white font-semibold transition-all active:scale-95 touch-manipulation min-h-[44px] sm:min-h-[52px] hover:bg-white/20"
              aria-label={isPracticeMode ? "Back to builder" : "View history"}
            >
              {isPracticeMode ? "Back to Builder" : "View History"}
            </button>
          )}

          {onRideAgain && (
            <button
              onClick={onRideAgain}
              className={`flex-1 rounded-full py-2.5 sm:py-3 text-sm sm:text-base font-semibold transition-all active:scale-95 touch-manipulation min-h-[44px] sm:min-h-[52px] ${
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
              className="flex-1 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 py-2.5 sm:py-3 text-sm sm:text-base text-fuchsia-200 font-semibold transition-all active:scale-95 touch-manipulation min-h-[44px] sm:min-h-[52px] hover:bg-fuchsia-500/20"
              aria-label="Share ride"
            >
              Share
            </button>
          )}

          {onExportTCX && (
            <button
              onClick={onExportTCX}
              className="flex-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 py-2.5 sm:py-3 text-sm sm:text-base text-indigo-300 font-semibold transition-all active:scale-95 touch-manipulation min-h-[44px] sm:min-h-[52px] hover:bg-indigo-500/20"
              aria-label="Export activity as TCX"
            >
              Export TCX
            </button>
          )}

          {isPracticeMode && onDeploy ? (
            <button
              onClick={onDeploy}
              className="flex-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 py-2.5 sm:py-3 text-sm sm:text-base text-white font-semibold shadow-lg shadow-indigo-500/50 transition-all active:scale-95 touch-manipulation min-h-[44px] sm:min-h-[52px] hover:opacity-90"
              aria-label="Deploy class"
            >
              Deploy Class
            </button>
          ) : (
            <button
              onClick={onClaimRewards}
              disabled={claimButtonDisabled}
              className="flex-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 py-2.5 sm:py-3 text-sm sm:text-base text-white font-semibold shadow-lg shadow-indigo-500/50 transition-all active:scale-95 touch-manipulation min-h-[44px] sm:min-h-[52px] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Request agent validation of rewards"
            >
              {claimButtonLabel}
            </button>
          )}
        </div>

        {/* Agent Validation Status */}
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 text-left text-xs text-white/70">
          Sync status: {syncStatus.replace("_", " ")}
          {syncStatus === "queued" ? " • queued for relay" : ""}
          {syncStatus === "relayed" ? " • relay acknowledged" : ""}
          {syncStatus === "anchored" ? " • on-chain commitment anchored" : ""}
          {syncStatus === "failed" ? " • retry from Journey when online" : ""}
        </div>

        {!isPracticeMode && rewardClaimStatus && (
          <div className="mt-4 rounded-xl border border-indigo-500/20 bg-black/30 p-3 text-left text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <span className="text-sm">🧠</span>
                {rewardClaimStatus.mode === "chainlink"
                  ? "Reward Verification"
                  : "ZK Claim Validation"}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  rewardClaimStatus.mode === "chainlink"
                    ? "bg-cyan-500/30 text-cyan-300"
                    : rewardClaimStatus.privacyLevel === "high"
                    ? "bg-emerald-500/30 text-emerald-300"
                    : rewardClaimStatus.privacyLevel === "medium"
                      ? "bg-amber-500/30 text-amber-300"
                      : "bg-zinc-500/30 text-zinc-300"
                }`}
              >
                {rewardClaimStatus.mode === "chainlink"
                  ? "CHAINLINK VERIFIED"
                  : `${rewardClaimStatus.privacyLevel.toUpperCase()} PRIVACY`}
              </span>
            </div>

            {(rewardClaimStatus.phase === "requesting" ||
              rewardClaimStatus.phase === "claiming") && (
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
                    {rewardClaimStatus.mode === "chainlink"
                      ? "Submitting telemetry verification request"
                      : "Verifying biometric integrity"}
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
                    {rewardClaimStatus.mode === "chainlink"
                      ? "Settling through IncentiveEngine"
                      : "Submitting proof to IncentiveEngine"}
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
                <p className="text-white/50 pl-7">
                  Verified effort score: {rewardClaimStatus.verifiedScore ?? 0}/1000
                </p>
              </div>
            )}

            {rewardClaimStatus.phase === "claimed" && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <svg
                      className="h-3 w-3 text-emerald-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
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
        )}

        {!isPracticeMode && (
          <>
            <div className="mt-5 rounded-xl border border-white/15 bg-black/20 p-3 text-left text-xs text-white/80">
              <p className="font-semibold text-white">Free included</p>
              <p>Live telemetry + ride summary</p>
              <p className="mt-2 font-semibold text-white">Premium unlock</p>
              <p>
                Historical trends, zone breakdowns, and AI coaching insights
              </p>
              {onUpgrade && (
                <button
                  onClick={() => {
                    trackEvent(ANALYTICS_EVENTS.PREMIUM_UPSELL_CLICKED, {
                      source: "ride-completion",
                    });
                    onUpgrade();
                  }}
                  className="mt-3 w-full rounded-lg border border-indigo-300/40 bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-500/30"
                >
                  Unlock Advanced Analytics
                </button>
              )}
            </div>

            {/* Performance Context */}
            <div className="mt-4 rounded-xl border border-white/15 bg-black/20 p-3 text-left text-xs text-white/80">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-white">
                  📊 Your Performance
                </span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-blue-500/30 text-blue-300">
                  Context
                </span>
              </div>
              <p className="text-white/60 mb-2">
                Here&apos;s how you performed:
              </p>
              <div className="grid grid-cols-2 gap-2 text-white/60">
                <div>
                  <p className="font-semibold text-white">Effort Score</p>
                  <p className="text-sm">{avgEffort}/1000</p>
                </div>
                <div>
                  <p className="font-semibold text-white">Duration</p>
                  <p className="text-sm">{formatTime(elapsedTime)}</p>
                </div>
              </div>
              <p className="text-white/60 mt-2">
                Aim for 900+ effort score to earn 50+ SPIN tokens!
              </p>
              <div className="mt-3 flex items-center justify-between text-white/60">
                <span>Current SPIN Earned:</span>
                <span className="font-bold text-amber-400">
                  {spinEarned} SPIN
                </span>
              </div>
              <p className="text-white/40 text-[10px] mt-1">
                Claim rewards after your ride to receive SPIN tokens.
              </p>
            </div>
          </>
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
    <div className="rounded-xl bg-white/10 p-3 sm:p-4">
      <p className="text-xs sm:text-sm text-white/50">{label}</p>
      <p
        className={`text-xl sm:text-2xl font-bold ${highlight ? "text-purple-400" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}
