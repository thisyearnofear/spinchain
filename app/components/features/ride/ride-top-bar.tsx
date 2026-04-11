"use client";

import { memo } from "react";
import { Z_LAYERS } from "@/app/lib/ui/z-layers";
import type { RewardMode } from "@/app/hooks/rewards/use-rewards";

interface RideTopBarProps {
  className: string;
  instructor: string;
  isPracticeMode: boolean;
  routeIsGenerated?: boolean;
  isRiding: boolean;
  isExiting: boolean;
  rideProgress: number;
  isTrainingMode: boolean;
  isGuestMode: boolean;
  useSimulator: boolean;
  bleConnected: boolean;
  walletConnected: boolean;
  rewardMode: RewardMode;
  rewardsFormattedReward: string;
  rewardsIsActive: boolean;
  rewardsClearNodeConnected?: boolean;
  viewMode: "immersive" | "focus";
  hudMode: "full" | "compact" | "minimal";
  // Focus mode control
  showClassInfo?: boolean;
  // Simulated rewards
  simulatedReward?: { isSimulating: boolean; formattedReward: string };
  // Callbacks
  onSetUseSimulator: (v: boolean) => void;
  onSetRewardMode: (m: RewardMode) => void;
  onExitRide: () => void;
  onResetPrefs: () => void;
  onCollapseToggle: () => void;
  isAllCollapsed: boolean;
}

export const RideTopBar = memo(function RideTopBar({
  className,
  instructor,
  isPracticeMode,
  routeIsGenerated = false,
  isRiding,
  isExiting,
  rideProgress,
  isTrainingMode,
  isGuestMode,
  useSimulator,
  bleConnected,
  walletConnected,
  rewardMode,
  rewardsFormattedReward,
  rewardsIsActive,
  rewardsClearNodeConnected,
  viewMode,
  simulatedReward,
  onSetUseSimulator,
  onSetRewardMode,
  onExitRide,
  onResetPrefs,
  onCollapseToggle,
  isAllCollapsed,
}: RideTopBarProps) {
  return (
    <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/90 to-transparent p-3 sm:p-6 pointer-events-auto safe-top" style={{ zIndex: Z_LAYERS.widgets + 15 }}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Class info */}
        <div className="flex-1 min-w-0 z-50 relative">
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-lg sm:text-2xl font-bold text-white truncate">
              {className}
            </h1>
            {isPracticeMode && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Practice
              </span>
            )}
            {routeIsGenerated && !isPracticeMode && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-500/20 text-zinc-400 text-xs font-medium shrink-0" title="Route loaded from approximation — live data unavailable">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                Approx. route
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-white/60 truncate">
            {instructor}
          </p>
          {(isRiding || rideProgress > 0) && (
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-2 py-0.5 text-[11px] text-white/80">
              <span className={`h-1.5 w-1.5 rounded-full ${
                bleConnected ? "bg-emerald-400" : useSimulator ? "bg-amber-400" : "bg-zinc-400"
              }`} />
              {bleConnected ? "Live telemetry" : useSimulator ? (isTrainingMode ? "Training Mode" : "Simulator telemetry") : "No telemetry"}
            </div>
          )}
        </div>

        {/* Right: Controls - overflow-safe */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-2 overflow-x-auto scrollbar-hide">
          {/* Training Mode Toggle (pre-ride only, desktop) */}
          {!isRiding && walletConnected && !isPracticeMode && (
            <button
              onClick={() => onSetUseSimulator(!useSimulator)}
              className={`hidden sm:flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-all border ${
                useSimulator
                  ? "border-amber-500/50 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                  : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80"
              }`}
              title={useSimulator ? "Disable Training Mode" : "Enable Training Mode"}
            >
              🎯
              <span>{useSimulator ? "Training" : "Train?"}</span>
              {useSimulator && <span className="text-amber-400/60 ml-0.5 text-[9px]">No rewards</span>}
            </button>
          )}

          {/* Reward Mode Selector (pre-ride) / Active Badge (during ride) */}
          {!isRiding ? (
            <div className="flex items-center gap-1" title={isGuestMode ? "Connect wallet to earn rewards" : undefined}>
              {(["zk-batch", "yellow-stream"] as RewardMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    if (isGuestMode) return;
                    if (m === "yellow-stream" && !walletConnected) return;
                    if (isTrainingMode && m === "yellow-stream") return;
                    onSetRewardMode(m);
                  }}
                  disabled={isGuestMode || (m === "yellow-stream" && !walletConnected) || (isTrainingMode && m === "yellow-stream")}
                  className={`rounded-lg px-2 py-1.5 text-[10px] sm:text-xs font-medium transition-all min-h-[36px] ${
                    rewardMode === m
                      ? "bg-white/20 text-white border border-white/30"
                      : "bg-white/5 text-white/40 border border-transparent hover:bg-white/10 hover:text-white/60"
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  {m === "zk-batch" ? "Standard" : "Live"}
                  {m === "yellow-stream" && (
                    <>
                      <span className="ml-1 text-[8px] text-yellow-400">β</span>
                      {rewardMode === "yellow-stream" && (
                        <span
                          className={`ml-1 inline-block h-1.5 w-1.5 rounded-full ${
                            rewardsClearNodeConnected ? "bg-emerald-400" : "bg-zinc-500"
                          }`}
                        />
                      )}
                    </>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-[10px] font-medium text-white/80">
              {/* Simulated reward ticker for training/guest */}
              {simulatedReward?.isSimulating ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-amber-300">~{simulatedReward.formattedReward} SPIN</span>
                  <span className="text-amber-400/50 text-[8px]">simulated</span>
                </>
              ) : rewardMode === "yellow-stream" ? (
                <>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    rewardsClearNodeConnected ? "bg-yellow-400 animate-pulse" : "bg-zinc-500"
                  }`} />
                  <span className="text-yellow-300">Live</span>
                  {rewardsFormattedReward !== "0" && (
                    <span className="text-yellow-400 font-bold">{rewardsFormattedReward} SPIN</span>
                  )}
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="text-indigo-300">Standard</span>
                  {rewardsFormattedReward !== "0" ? (
                    <span className="text-indigo-200 font-bold">{rewardsFormattedReward} SPIN</span>
                  ) : rewardsIsActive ? (
                    <span className="text-indigo-300/60 italic">Processing…</span>
                  ) : null}
                </>
              )}
            </div>
          )}

          {/* Collapse/Expand (desktop only) */}
          <button
            onClick={onCollapseToggle}
            className="hidden sm:inline-flex rounded-lg bg-white/10 px-3 py-2 text-xs sm:text-sm text-white/60 hover:bg-white/20 active:scale-95 transition-all touch-manipulation min-h-[44px]"
            aria-label={isAllCollapsed ? "Expand all panels" : "Collapse all panels"}
            title="Press C to toggle"
          >
            {isAllCollapsed ? "▢ Expand" : "▤ Collapse"}
          </button>

          {/* Reset (desktop only) */}
          <button
            onClick={onResetPrefs}
            className="hidden sm:inline-flex rounded-lg bg-white/10 px-3 py-2 text-xs sm:text-sm text-white/60 hover:bg-white/20 active:scale-95 transition-all touch-manipulation min-h-[44px]"
            aria-label="Reset ride UI preferences"
          >
            Reset
          </button>

          {/* View mode badge (mobile only) */}
          <span className="sm:hidden inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] text-white/50">
            {viewMode === "focus" ? "2D" : "3D"}
          </span>

          {/* Exit Button */}
          <button
            onClick={onExitRide}
            disabled={isExiting}
            className="rounded-lg bg-white/10 p-2 text-white/70 hover:bg-white/20 active:scale-95 transition-all touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Exit ride"
          >
            {isExiting ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" opacity="0.3" />
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="15 45" opacity="0.8" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});
