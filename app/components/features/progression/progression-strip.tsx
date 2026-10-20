"use client";

/**
 * ProgressionStrip — the front door's promise.
 *
 * A first-time rider has never seen the game. A returning rider wants to
 * know where they stand. This strip answers both in one glance, and it sits
 * inside the first viewport so the game is visible *before* the ride.
 *
 * Wedge guardrail: [the gamification must be visible before the ride](../../docs/WEDGE.md#the-gamification-must-be-visible-before-the-ride)
 */

import { m } from "framer-motion";
import { Lock, Sparkles, Trophy } from "lucide-react";
import { RANKS, formatXp, useProgression } from "@/app/lib/progression";
import { RankEmblem, RankProgressBar } from "@/app/components/features/progression/rank-card";
import { useMilestones } from "@/app/lib/milestones";
import { EASE_SMOOTH } from "@/app/lib/motion";
import { usePrefersReducedMotion } from "@/app/hooks/use-prefers-reduced-motion";

export function ProgressionStrip() {
  const { totalRides } = useMilestones();
  const progression = useProgression();
  const reduced = usePrefersReducedMotion();
  const { rank, next, progress, xpToNext, nextUnlock: upcoming } = progression;

  const rise = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.35, delay, ease: EASE_SMOOTH },
        };

  if (totalRides === 0) {
    // First-timers: show the ladder ahead, not a bar they can't read yet.
    const preview = RANKS.slice(0, 5);
    return (
      <m.div
        className="w-full rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3.5"
        data-testid="progression-strip"
        {...rise(0.2)}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--accent)]">
              Your climb starts here
            </div>
            <div className="mt-0.5 text-xs text-[color:var(--muted)]">
              Every ride earns XP. Ten ranks from Spark to Singularity.
            </div>
          </div>

          <ol className="flex items-center gap-1.5" aria-label="Rank ladder preview">
            {preview.map((r, i) => (
              <li key={r.index} className="flex items-center gap-1.5">
                {i > 0 ? (
                  <span className="h-px w-3 bg-white/12" aria-hidden="true" />
                ) : null}
                <span
                  className="rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.55)",
                  }}
                  title={r.title}
                >
                  {r.name}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </m.div>
    );
  }

  return (
    <m.div
      className="w-full rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3.5"
      data-testid="progression-strip"
      {...rise(0.2)}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-3">
          <RankEmblem rank={rank} size={40} />
          <div className="leading-tight">
            <div
              className="text-[10px] font-black uppercase tracking-[0.2em]"
              style={{ color: rank.color }}
            >
              Rank {rank.index + 1} of {RANKS.length}
            </div>
            <div className="text-sm font-bold text-[color:var(--foreground)]">
              {rank.title}
            </div>
          </div>
        </div>

        <div className="min-w-[160px] flex-1">
          <div className="mb-1 flex items-baseline justify-between text-[10px] font-semibold text-[color:var(--muted)]">
            <span className="tabular-nums">{formatXp(progression.totalXp)} XP</span>
            <span className="tabular-nums">
              {next ? (
                <>
                  {formatXp(xpToNext)} to {next.name}
                </>
              ) : (
                "Top of the ladder"
              )}
            </span>
          </div>
          <RankProgressBar progress={progress} color={rank.color} height={6} />
        </div>

        {upcoming ? (
          <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-1.5">
            <span
              className="grid h-6 w-6 place-items-center rounded-lg bg-white/5 text-[color:var(--muted)]"
              aria-hidden="true"
            >
              {upcoming.kind === "world" ? (
                <Sparkles className="h-3 w-3" />
              ) : (
                <Trophy className="h-3 w-3" />
              )}
            </span>
            <div className="leading-tight">
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]/70">
                Next unlock
              </div>
              <div className="text-xs font-bold text-[color:var(--foreground)]">
                {upcoming.label}
              </div>
            </div>
            <Lock className="ml-1 h-3 w-3 text-[color:var(--muted)]/50" aria-hidden="true" />
          </div>
        ) : null}
      </div>
    </m.div>
  );
}
