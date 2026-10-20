"use client";

import { Bike, Flame, Waves, Zap } from "lucide-react";
import { useMilestones } from "@/app/lib/milestones";
import { formatXp, useProgression } from "@/app/lib/progression";
import { RankChip, RankEmblem, RankProgressBar } from "@/app/components/features/progression/rank-card";

/**
 * GamificationBar — surface game signals on the front door.
 *
 * The ladder (rank + XP to the next rank) is the headline; the raw stats
 * are the supporting cast. A rider with zero rides still sees a rank and a
 * goal, because a blank strip teaches nothing about the game.
 *
 * Wedge guardrail: [visible game](../../docs/WEDGE.md#the-gamification-must-be-visible-before-the-ride)
 */

/** Rider-facing duration: 1 decimal under 10m, whole minutes above. */
export function formatFlowMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0";
  return minutes < 10 ? String(Number(minutes.toFixed(1))) : String(Math.round(minutes));
}

export function GamificationBar() {
  const { streak, totalRides, bestMaxPower, totalFlowMinutes } = useMilestones();
  const progression = useProgression();
  const { rank, next, progress, xpToNext } = progression;

  // Zero-state: still show the ladder. A blank strip is not a game.
  if (totalRides === 0) {
    return (
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
        data-testid="gamification-bar"
      >
        <RankEmblem rank={rank} size={36} />
        <div className="min-w-[190px] flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">
              Rank 1 · {rank.name}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--muted)]">
            Your first ride starts the climb
          </div>
          <RankProgressBar progress={progress} color={rank.color} height={5} className="mt-2" />
        </div>
        <span className="text-[11px] text-[var(--muted)]/70">
          Streaks, milestones and flow tracking unlock as you ride
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
      data-testid="gamification-bar"
    >
      {/* Rank — the headline signal */}
      <div className="flex items-center gap-2.5">
        <RankEmblem rank={rank} size={34} />
        <div className="leading-tight">
          <div className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: rank.color }}>
            {rank.name}
          </div>
          <div className="text-[10px] font-semibold tabular-nums text-[var(--muted)]">
            {formatXp(progression.totalXp)} XP
          </div>
        </div>
      </div>

      {/* Progress to next rank */}
      <div className="min-w-[130px] flex-1">
        <div className="mb-1 flex items-baseline justify-between text-[10px] font-semibold text-[var(--muted)]">
          <span>
            {next ? (
              <>
                {formatXp(xpToNext)} to{" "}
                <span style={{ color: next.color }}>{next.name}</span>
              </>
            ) : (
              "Top rank"
            )}
          </span>
          <span className="tabular-nums">{Math.round(progress * 100)}%</span>
        </div>
        <RankProgressBar progress={progress} color={rank.color} height={5} />
      </div>

      {/* Streak */}
      {streak > 0 && (
        <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 border border-amber-500/20">
          <Flame className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
          <span className="text-amber-400 font-bold">{streak}</span>
          <span className="text-[var(--muted)]/70">day streak</span>
        </div>
      )}

      {/* Total rides */}
      <div className="flex items-center gap-1.5">
        <Bike className="h-3.5 w-3.5 text-[var(--muted)]/50" aria-hidden="true" />
        <span className="font-bold text-[var(--foreground)]">{totalRides}</span>
        <span className="text-[var(--muted)]/70">rides</span>
      </div>

      {/* Best power */}
      {bestMaxPower > 0 && (
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-[var(--muted)]/50" aria-hidden="true" />
          <span className="font-bold text-[var(--foreground)]">{bestMaxPower}W</span>
          <span className="text-[var(--muted)]/70">best</span>
        </div>
      )}

      {/* Flow minutes */}
      {totalFlowMinutes > 0 && (
        <div className="flex items-center gap-1.5">
          <Waves className="h-3.5 w-3.5 text-[var(--muted)]/50" aria-hidden="true" />
          <span className="font-bold text-[var(--foreground)] tabular-nums">{formatFlowMinutes(totalFlowMinutes)}m</span>
          <span className="text-[var(--muted)]/70">flow</span>
        </div>
      )}
    </div>
  );
}

export { RankChip };
