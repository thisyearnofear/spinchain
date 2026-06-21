"use client";

import { memo, useState, useRef, useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { Z_LAYERS } from "@/app/lib/ui/z-layers";
import { useRideStore } from "@/app/stores/ride-store";
import { useRewardsStore } from "@/app/stores/rewards-store";
import { useUIStore } from "@/app/stores/ui-store";
import { useProfile, getDisplayName } from "@/app/hooks/common/use-profile";
import { getRideHistory, getStreakStats } from "@/app/lib/analytics/ride-history";
import type { RewardMode } from "@/app/hooks/rewards/use-rewards";

interface RideTopBarProps {
  className: string;
  instructor: string;
  routeIsGenerated?: boolean;
  walletConnected: boolean;
  simulatedReward?: { isSimulating: boolean; formattedReward: string };
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
  routeIsGenerated = false,
  walletConnected,
  simulatedReward,
  onSetUseSimulator,
  onSetRewardMode,
  onExitRide,
  onResetPrefs,
  onCollapseToggle,
  isAllCollapsed,
}: RideTopBarProps) {
  const isRiding = useRideStore((s) => s.isActive);
  const isExiting = useRideStore((s) => s.isExiting);
  const rideProgress = useRideStore((s) => s.rideProgress);

  const rewardMode = useRewardsStore((s) => s.mode);
  const rewardsFormattedReward = useRewardsStore((s) => s.formattedReward);
  const rewardsIsActive = useRewardsStore((s) => s.isActive);
  const rewardsClearNodeConnected = useRewardsStore((s) => s.clearNodeConnected);

  const viewMode = useUIStore((s) => s.viewMode);
  const hudMode = useUIStore((s) => s.hudMode);
  const useSimulator = useUIStore((s) => s.useSimulator);
  const bleConnected = useUIStore((s) => s.bleConnected);
  const isPracticeMode = useUIStore((s) => s.isPracticeMode);
  const isTrainingMode = useUIStore((s) => s.isTrainingMode);
  const isGuestMode = useUIStore((s) => s.isGuestMode);

  const toggleViewMode = useUIStore((s) => s.toggleViewMode);
  const cycleHudMode = useUIStore((s) => s.cycleHudMode);

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Rider identity
  const { address } = useAccount();
  const { profile } = useProfile(address);
  const riderName = useMemo(() => {
    if (profile) return getDisplayName(profile, address ?? "");
    if (isPracticeMode) return "Rider";
    if (address) return `${address.slice(0, 6)}…${address.slice(-4)}`;
    return "Guest Rider";
  }, [profile, address, isPracticeMode]);

  const streak = useMemo(() => {
    const rides = getRideHistory();
    return getStreakStats(rides);
  }, []);

  useEffect(() => {
    if (!showMoreMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMoreMenu]);

  return (
    <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/90 to-transparent p-3 sm:p-6 pointer-events-auto safe-top" style={{ zIndex: Z_LAYERS.widgets + 15 }}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Rider identity + Class info */}
        <div className="flex-1 min-w-0 z-50 relative">
          {/* Rider chip — avatar + name + streak */}
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center gap-1.5 rounded-full bg-white/8 border border-white/10 pl-1 pr-2.5 py-0.5">
              {/* Avatar */}
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[9px] font-bold text-white shrink-0 overflow-hidden">
                {profile?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  riderName.charAt(0).toUpperCase()
                )}
              </div>
              <span className="text-[11px] font-semibold text-white/90 truncate max-w-[100px]">
                {riderName}
              </span>
              {streak.daily > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-orange-400 shrink-0" title={`${streak.daily}-day streak`}>
                  🔥{streak.daily}
                </span>
              )}
            </div>
          </div>
          {/* Class info — compact single-line metadata */}
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-xl font-bold text-white truncate">
              {className}
            </h1>
            {isPracticeMode && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-medium shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Practice
              </span>
            )}
            {routeIsGenerated && !isPracticeMode && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-zinc-500/20 text-zinc-400 text-[10px] font-medium shrink-0" title="Route loaded from approximation — live data unavailable">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                Approx.
              </span>
            )}
            {/* Telemetry status — inline, compact */}
            {(isRiding || rideProgress > 0) && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[10px] text-white/70 shrink-0">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  bleConnected ? "bg-emerald-400" : useSimulator ? "bg-amber-400" : "bg-zinc-400"
                }`} />
                {bleConnected ? "Live" : useSimulator ? (isTrainingMode ? "Training" : "Simulator") : "No signal"}
              </span>
            )}
          </div>
          {/* Instructor — hidden in practice mode (redundant with "Practice" badge) */}
          {!isPracticeMode && (
            <p className="text-xs text-white/50 truncate mt-0.5">
              {instructor}
            </p>
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

          {/* Reward Mode Selector (pre-ride, wallet-connected only) / Active Badge (during ride) */}
          {!isRiding ? (
            isGuestMode || isPracticeMode ? (
              !isPracticeMode && (
                <div
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-white/40"
                  title="Connect wallet to earn SPIN tokens"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
                  <span>Connect to earn</span>
                </div>
              )
            ) : (
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
                    {m === "zk-batch" ? "Verified" : "Live Stream"}
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
            )
          ) : (
            !isPracticeMode && !isTrainingMode && !isGuestMode && (
              <div className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-[10px] font-medium text-white/80">
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
                    <span className="text-indigo-300">Verified</span>
                    {rewardsFormattedReward !== "0" ? (
                      <span className="text-indigo-200 font-bold">{rewardsFormattedReward} SPIN</span>
                    ) : rewardsIsActive ? (
                      <span className="text-indigo-300/60 italic">Processing…</span>
                    ) : null}
                  </>
                )}
              </div>
            )
          )}

          {/* Collapse / Reset — grouped in a dropdown (desktop only) */}
          <div className="hidden sm relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu(v => !v)}
              className="rounded-lg bg-white/10 p-2 text-white/60 hover:bg-white/20 active:scale-95 transition-all touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="More options"
              aria-expanded={showMoreMenu}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
              </svg>
            </button>
            {showMoreMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 rounded-xl border border-white/10 bg-black/90 backdrop-blur-xl p-1 min-w-[160px] shadow-xl">
                  <button
                    onClick={() => { onCollapseToggle(); setShowMoreMenu(false); }}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/70 hover:bg-white/10 transition-all"
                  >
                    {isAllCollapsed ? "▢ Expand panels" : "▤ Collapse panels"}
                  </button>
                  <button
                    onClick={() => { onResetPrefs(); setShowMoreMenu(false); }}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/70 hover:bg-white/10 transition-all"
                  >
                    Reset preferences
                  </button>
                </div>
              </>
            )}
          </div>

          {/* View Mode Toggle */}
          <button
            onClick={toggleViewMode}
            className="rounded-lg bg-white/10 p-2 text-white/70 hover:bg-white/20 active:scale-95 transition-all touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Toggle view mode"
            title={`Press V — ${viewMode === "immersive" ? "Switch to 2D focus" : "Switch to immersive 3D"}`}
          >
            {viewMode === "immersive" ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6v6H9z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
              </svg>
            )}
          </button>

          {/* HUD Mode Toggle (all devices) */}
          <button
            onClick={cycleHudMode}
            className={`rounded-lg bg-white/10 p-2 text-white/70 hover:bg-white/20 active:scale-95 transition-all touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center ${hudMode === "minimal" ? "bg-indigo-500/30 border border-indigo-500/40" : ""}`}
            aria-label={`HUD mode: ${hudMode}`}
            title={`HUD: ${hudMode} (press H)`}
          >
            {hudMode === "full" ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            ) : hudMode === "compact" ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8M4 18h16" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>

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
