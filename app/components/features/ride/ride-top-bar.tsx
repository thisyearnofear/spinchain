"use client";

import { memo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Z_LAYERS } from "@/app/lib/ui/z-layers";
import { useRideStore, selectRidePhase } from "@/app/stores/ride-store";
import { useRewardsStore } from "@/app/stores/rewards-store";
import { useUIStore } from "@/app/stores/ui-store";
import type { RewardMode } from "@/app/hooks/rewards/use-rewards";
import { EASE_SMOOTH } from "@/app/lib/motion";

interface RideTopBarProps {
  className: string;
  instructor: string;
  routeIsGenerated?: boolean;
  walletConnected: boolean;
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
  onSetUseSimulator,
  onSetRewardMode,
  onExitRide,
  onResetPrefs,
  onCollapseToggle,
  isAllCollapsed,
}: RideTopBarProps) {
  const phase = useRideStore(selectRidePhase);
  const isExiting = useRideStore((s) => s.isExiting);
  const isActive = phase === "active" || phase === "paused";

  const rewardMode = useRewardsStore((s) => s.mode);
  const rewardsFormattedReward = useRewardsStore((s) => s.formattedReward);
  const rewardsIsActive = useRewardsStore((s) => s.isActive);
  const rewardsClearNodeConnected = useRewardsStore((s) => s.clearNodeConnected);
  const rewardsIsSimulating = useRewardsStore((s) => s.isSimulating);
  const rewardsSimulatedReward = useRewardsStore((s) => s.simulatedReward);

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
  const showPreRideSetup = phase === "preRide";
  const telemetryLabel = bleConnected ? "Live" : useSimulator ? (isTrainingMode ? "Training" : "Simulator") : "No signal";
  const telemetryColor = bleConnected ? "bg-emerald-400" : useSimulator ? "bg-amber-400" : "bg-zinc-400";

  return (
    <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/90 to-transparent p-3 sm:p-5 pointer-events-auto safe-top" style={{ zIndex: Z_LAYERS.widgets + 15 }}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Class identity — phase-aware */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {isActive ? (
              <motion.div
                key="active"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.2, ease: EASE_SMOOTH }}
                className="flex items-center gap-2"
              >
                <h1 className="text-sm sm:text-base font-bold text-white/90 truncate">
                  {className}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white/60 shrink-0">
                  <span className={`h-1.5 w-1.5 rounded-full ${telemetryColor}`} />
                  {telemetryLabel}
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="pre-ride"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.2, ease: EASE_SMOOTH }}
              >
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-xl font-bold text-white truncate">
                    {className}
                  </h1>
                  {routeIsGenerated && !isPracticeMode && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-zinc-500/20 text-zinc-400 text-[10px] font-medium shrink-0" title="Route loaded from approximation — live data unavailable">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                      Approx.
                    </span>
                  )}
                </div>
                {!isPracticeMode && (
                  <p className="text-xs text-white/40 truncate mt-0.5">
                    {instructor}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Controls — phase-aware */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Active reward badge — compact, during ride only */}
          {isActive && !isPracticeMode && !isTrainingMode && !isGuestMode && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 text-[10px] font-medium text-white/70">
              {rewardsIsSimulating ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-amber-300">~{rewardsSimulatedReward}</span>
                </>
              ) : rewardMode === "yellow-stream" ? (
                <>
                  <span className={`h-1.5 w-1.5 rounded-full ${rewardsClearNodeConnected ? "bg-yellow-400 animate-pulse" : "bg-zinc-500"}`} />
                  <span className="text-yellow-300">{rewardsFormattedReward !== "0" ? `${rewardsFormattedReward} SPIN` : "Live"}</span>
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="text-indigo-300">{rewardsFormattedReward !== "0" ? `${rewardsFormattedReward} SPIN` : rewardsIsActive ? "Processing…" : "Verified"}</span>
                </>
              )}
            </div>
          )}

          {/* Pre-ride: reward mode + training toggle in "more" dropdown */}
          {showPreRideSetup && !isPracticeMode && !isGuestMode && walletConnected && (
            <div className="hidden sm:flex items-center gap-1">
              {(["zk-batch", "yellow-stream"] as RewardMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    if (m === "yellow-stream" && (!walletConnected || isTrainingMode)) return;
                    onSetRewardMode(m);
                  }}
                  disabled={m === "yellow-stream" && (!walletConnected || isTrainingMode)}
                  className={`rounded-lg px-2 py-1.5 text-[10px] font-medium transition-all ${
                    rewardMode === m
                      ? "bg-white/15 text-white border border-white/25"
                      : "bg-white/5 text-white/40 border border-transparent hover:bg-white/10 hover:text-white/60"
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  {m === "zk-batch" ? "Verified" : "Live"}
                </button>
              ))}
            </div>
          )}

          {showPreRideSetup && !isPracticeMode && isGuestMode && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-white/40" title="Connect wallet to earn SPIN tokens">
              <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
              <span>Connect to earn</span>
            </div>
          )}

          {/* More menu — collapse/reset (desktop) + training toggle (pre-ride) */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu(v => !v)}
              className="rounded-lg bg-white/10 p-2 text-white/60 hover:bg-white/20 active:scale-95 transition-all touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center"
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
                <div className="absolute right-0 top-full mt-1 z-50 rounded-xl border border-white/10 bg-black/95 p-1 min-w-[180px] shadow-xl">
                  {showPreRideSetup && walletConnected && !isPracticeMode && (
                    <button
                      onClick={() => { onSetUseSimulator(!useSimulator); setShowMoreMenu(false); }}
                      className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs text-white/70 hover:bg-white/10 transition-all"
                    >
                      <span className="flex items-center gap-1.5">
                        <span>🎯</span>
                        <span>Training Mode</span>
                      </span>
                      <span className={`text-[10px] font-bold ${useSimulator ? "text-amber-400" : "text-white/30"}`}>
                        {useSimulator ? "ON" : "OFF"}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => { onCollapseToggle(); setShowMoreMenu(false); }}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/70 hover:bg-white/10 transition-all"
                  >
                    {isAllCollapsed ? "Expand panels" : "Collapse panels"}
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
            className="rounded-lg bg-white/10 p-2 text-white/60 hover:bg-white/20 active:scale-95 transition-all touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center"
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

          {/* HUD Mode Toggle */}
          <button
            onClick={cycleHudMode}
            className={`rounded-lg bg-white/10 p-2 text-white/60 hover:bg-white/20 active:scale-95 transition-all touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center ${hudMode === "minimal" ? "bg-indigo-500/30 border border-indigo-500/40" : ""}`}
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

          {/* Exit */}
          <button
            onClick={onExitRide}
            disabled={isExiting}
            className="rounded-lg bg-white/10 p-2 text-white/60 hover:bg-white/20 active:scale-95 transition-all touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
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
