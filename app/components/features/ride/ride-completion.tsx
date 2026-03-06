"use client";

/**
 * RideCompletion - Post-ride summary and actions
 * 
 * Core Principles:
 * - MODULAR: Self-contained completion screen
 * - ACCESSIBLE: Focus management for modal
 * - CLEAN: Props-based, no external dependencies
 */

import { useEffect, useRef } from "react";
import { formatTime } from "@/app/lib/formatters";
import { ANALYTICS_EVENTS, trackEvent } from "@/app/lib/analytics/events";

interface ZKProofStatus {
  isGenerating: boolean;
  isSuccess: boolean;
  privacyScore: number;
  privacyLevel: 'high' | 'medium' | 'low';
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
  onDeploy?: () => void;
  onUpgrade?: () => void;
  onClaimRewards?: () => void;
  zkProofStatus?: ZKProofStatus;
  spinEarned?: string;
}

export function RideCompletion({
  isPracticeMode,
  elapsedTime,
  avgHeartRate,
  avgPower,
  avgEffort,
  telemetrySource,
  onExit,
  onDeploy,
  onUpgrade,
  onClaimRewards,
  zkProofStatus,
  spinEarned = "0",
}: RideCompletionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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
        {/* Success Icon */}
        <div className="h-12 w-12 sm:h-20 sm:w-20 mx-auto mb-3 sm:mb-5 rounded-full bg-gradient-to-r from-green-400 to-emerald-400 flex items-center justify-center">
          <svg
            className="h-6 w-6 sm:h-10 sm:w-10 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Title */}
        <h2
          id="completion-title"
          className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2"
        >
          {isPracticeMode ? "Practice Complete!" : "Ride Complete!"}
        </h2>
        <p className="text-sm sm:text-base text-white/70 mb-3 sm:mb-5">
          {isPracticeMode
            ? "Great way to preview your class!"
            : `Total Time: ${formatTime(elapsedTime)}`}
        </p>

        {/* SPIN Token Explanation */}
        <div className="mb-4 rounded-xl border border-white/15 bg-black/20 p-3 text-left text-xs text-white/80">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-white">🎉 SPIN Token Earnings</span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-500/30 text-amber-300">
              How It Works
            </span>
          </div>
          <p className="text-white/60 mb-2">Earn SPIN tokens based on your performance:</p>
          <ul className="text-white/60 space-y-1 pl-4">
            <li className="flex items-start gap-2">
              <svg className="h-4 w-4 text-amber-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span>Effort Score ({avgEffort}/1000): Higher effort = more tokens</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="h-4 w-4 text-amber-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span>Duration ({formatTime(elapsedTime)}): Longer workouts = higher rewards</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="h-4 w-4 text-amber-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span>Consistency: Steady effort throughout = bonus tokens</span>
            </li>
          </ul>
          <p className="text-white/60 mt-2">Your {avgEffort} effort score earned you {spinEarned} SPIN tokens.</p>
        </div>

        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/80">
          <span className={`h-2 w-2 rounded-full ${
            telemetrySource === "live-bike"
              ? "bg-emerald-400"
              : telemetrySource === "simulator"
                ? "bg-amber-400"
                : "bg-zinc-400"
          }`} />
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
            <span className="font-semibold text-white">🚀 Boost Your Earnings</span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-green-500/30 text-green-300">
              Next Time
            </span>
          </div>
          <p className="text-white/60 mb-2">Improve your SPIN earnings with these tips:</p>
          <ul className="text-white/60 space-y-1 pl-4">
            <li className="flex items-start gap-2">
              <svg className="h-4 w-4 text-green-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span>Increase effort score: Push harder during intervals</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="h-4 w-4 text-green-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span>Extend duration: Add 5-10 minutes to your workout</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="h-4 w-4 text-green-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span>Maintain consistency: Keep effort above 700 throughout</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="h-4 w-4 text-green-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span>Complete more classes: Regular workouts = bonus rewards</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button
            onClick={onExit}
            className="flex-1 rounded-full border border-white/20 bg-white/10 py-2.5 sm:py-3 text-sm sm:text-base text-white font-semibold transition-all active:scale-95 touch-manipulation min-h-[44px] sm:min-h-[52px] hover:bg-white/20"
            aria-label={isPracticeMode ? "Back to builder" : "View journey"}
          >
            {isPracticeMode ? "Back to Builder" : "View Journey"}
          </button>

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
              disabled={zkProofStatus?.isGenerating || zkProofStatus?.isSuccess}
              className="flex-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 py-2.5 sm:py-3 text-sm sm:text-base text-white font-semibold shadow-lg shadow-indigo-500/50 transition-all active:scale-95 touch-manipulation min-h-[44px] sm:min-h-[52px] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label="Claim rewards with ZK proof"
            >
              {zkProofStatus?.isGenerating
                ? 'Generating Proof…'
                : zkProofStatus?.isSuccess
                  ? '✓ Rewards Claimed'
                  : 'Claim Rewards'}
            </button>
          )}
        </div>

        {/* ZK Privacy Proof Status */}
        {!isPracticeMode && zkProofStatus && (
          <div className="mt-4 rounded-xl border border-white/15 bg-black/20 p-3 text-left text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-white">🔒 ZK Privacy Proof</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                zkProofStatus.privacyLevel === 'high'
                  ? 'bg-emerald-500/30 text-emerald-300'
                  : zkProofStatus.privacyLevel === 'medium'
                    ? 'bg-amber-500/30 text-amber-300'
                    : 'bg-zinc-500/30 text-zinc-300'
              }`}>
                {zkProofStatus.privacyLevel.toUpperCase()} PRIVACY
              </span>
            </div>
            {zkProofStatus.isGenerating && (
              <p className="text-white/60">Generating proof — your raw biometrics stay private…</p>
            )}
            {zkProofStatus.isSuccess && (
              <p className="text-emerald-300">Proof verified on-chain. Privacy score: {zkProofStatus.privacyScore}/100</p>
            )}
            {zkProofStatus.error && (
              <p className="text-red-300">Proof failed — falling back to signed attestation.</p>
            )}
            {!zkProofStatus.isGenerating && !zkProofStatus.isSuccess && !zkProofStatus.error && (
              <p className="text-white/60">Claim rewards to generate a ZK proof of your effort.</p>
            )}
          </div>
        )}

        {!isPracticeMode && (
          <>
            <div className="mt-5 rounded-xl border border-white/15 bg-black/20 p-3 text-left text-xs text-white/80">
              <p className="font-semibold text-white">Free included</p>
              <p>Live telemetry + ride summary</p>
              <p className="mt-2 font-semibold text-white">Premium unlock</p>
              <p>Historical trends, zone breakdowns, and AI coaching insights</p>
              {onUpgrade && (
                <button
                  onClick={() => {
                    trackEvent(ANALYTICS_EVENTS.PREMIUM_UPSELL_CLICKED, {
                      source: 'ride-completion',
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
                <span className="font-semibold text-white">📊 Your Performance</span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-blue-500/30 text-blue-300">
                  Context
                </span>
              </div>
              <p className="text-white/60 mb-2">Here's how you performed:</p>
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
              <p className="text-white/60 mt-2">Aim for 900+ effort score to earn 50+ SPIN tokens!</p>
              <div className="mt-3 flex items-center justify-between text-white/60">
                <span>Current SPIN Earned:</span>
                <span className="font-bold text-amber-400">{spinEarned} SPIN</span>
              </div>
              <p className="text-white/40 text-[10px] mt-1">Claim rewards after your ride to receive SPIN tokens.</p>
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
      <p className={`text-xl sm:text-2xl font-bold ${highlight ? "text-purple-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
