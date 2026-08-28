"use client";

import { useMilestones } from "@/app/lib/milestones";

/**
 * GamificationBar — surface game signals on the front door.
 *
 * Shows streak, total rides, best power, and flow minutes.
 * The game exists but is invisible — this makes it the reason to click "Join".
 *
 * Wedge guardrail: [visible game](../../docs/WEDGE.md#the-gamification-must-be-visible-before-the-ride)
 */
export function GamificationBar() {
  const { streak, totalRides, bestMaxPower, totalFlowMinutes } = useMilestones();

  // Early return for zero-state — looks like nothing
  if (totalRides === 0) {
    return (
      <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
        <span>Start your first ride to unlock streaks, milestones, and flow tracking</span>
        <span className="text-accent">→</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-[var(--muted)]">
      {/* Streak */}
      {streak > 0 && (
        <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 border border-amber-500/20">
          <span className="text-sm">🔥</span>
          <span className="text-amber-400 font-bold">{streak}</span>
          <span className="text-[var(--muted)]/70">day streak</span>
        </div>
      )}

      {/* Total rides */}
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--muted)]/50">🚴</span>
        <span className="font-bold text-[var(--foreground)]">{totalRides}</span>
        <span className="text-[var(--muted)]/70">rides</span>
      </div>

      {/* Best power */}
      {bestMaxPower > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--muted)]/50">⚡</span>
          <span className="font-bold text-[var(--foreground)]">{bestMaxPower}W</span>
          <span className="text-[var(--muted)]/70">best</span>
        </div>
      )}

      {/* Flow minutes */}
      {totalFlowMinutes > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--muted)]/50">🌊</span>
          <span className="font-bold text-[var(--foreground)]">{totalFlowMinutes}m</span>
          <span className="text-[var(--muted)]/70">flow</span>
        </div>
      )}
    </div>
  );
}