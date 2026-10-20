"use client";

/**
 * RiderProgressPanel — the dashboard's game surface.
 *
 * Three answers in one card: where am I on the ladder, how close am I to
 * this week's goal, and what did I earn last time. Everything else on the
 * dashboard is chrome around this.
 *
 * Wedge guardrails: visible game, one primary CTA (this panel never competes
 * with the page's single main action), rider language only.
 */

import Link from "next/link";
import { ChevronRight, Flag, Target, TrendingUp } from "lucide-react";
import { m } from "framer-motion";
import { RankCard } from "@/app/components/features/progression/rank-card";
import { useProgression } from "@/app/lib/progression";
import { useRiderStats } from "@/app/hooks/common/use-rider-stats";
import {
  getWeeklyGoalProgress,
  getStreakStats,
  getPRs,
} from "@/app/lib/analytics/ride-history";
import { EASE_SMOOTH } from "@/app/lib/motion";
import { usePrefersReducedMotion } from "@/app/hooks/use-prefers-reduced-motion";

const WEEKLY_RIDE_GOAL = 4;

export function RiderProgressPanel() {
  const progression = useProgression();
  const { rides } = useRiderStats();
  const reduced = usePrefersReducedMotion();

  const goal = getWeeklyGoalProgress(rides, WEEKLY_RIDE_GOAL);
  const streaks = getStreakStats(rides);
  const prs = getPRs(rides);

  const rise = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay, ease: EASE_SMOOTH },
        };

  return (
    <section
      className="grid gap-4 lg:grid-cols-[1.35fr_1fr]"
      aria-label="Your progression"
      data-testid="rider-progress-panel"
    >
      <m.div {...rise(0)}>
        <RankCard />
      </m.div>

      <m.div
        className="flex flex-col gap-4"
        {...rise(0.06)}
      >
        {/* Weekly goal */}
        <div className="rounded-3xl border border-white/10 bg-[var(--surface)]/85 p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
                <Target className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-sm font-bold text-[var(--foreground)]">
                This week
              </h3>
            </div>
            <span className="text-[11px] font-semibold tabular-nums text-[var(--muted)]">
              {goal.completedRides} / {goal.targetRides} rides
            </span>
          </div>

          <div className="mt-4 flex gap-1.5" aria-hidden="true">
            {Array.from({ length: goal.targetRides }).map((_, i) => {
              const filled = i < goal.completedRides;
              return (
                <div
                  key={i}
                  className="h-2 flex-1 rounded-full transition-colors"
                  style={{
                    background: filled
                      ? "linear-gradient(90deg, var(--accent), var(--accent-strong))"
                      : "rgba(255,255,255,0.08)",
                    boxShadow: filled ? "0 0 10px rgba(249,115,22,0.4)" : "none",
                  }}
                />
              );
            })}
          </div>

          <p className="mt-3 text-xs text-[var(--muted)]">
            {goal.remainingRides > 0 ? (
              <>
                <span className="font-bold text-[var(--foreground)]">
                  {goal.remainingRides}
                </span>{" "}
                more ride{goal.remainingRides === 1 ? "" : "s"} to hit your goal
              </>
            ) : (
              <span className="font-bold text-[var(--success)]">
                Goal cleared — momentum unlocked
              </span>
            )}
          </p>

          <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-3 text-xs">
            <span className="flex items-center gap-1.5 text-[var(--muted)]">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="tabular-nums">
                {streaks.daily}d streak
                {streaks.weekly > 0 ? ` · ${streaks.weekly}w` : ""}
              </span>
            </span>
            <span className="text-[var(--muted)]">
              PR <span className="tabular-nums font-bold text-[var(--foreground)]">{prs.bestPower}W</span>
            </span>
          </div>
        </div>

        {/* Journey link — the full ladder lives one click away */}
        <Link
          href="/rider/journey"
          className="group flex items-center justify-between gap-3 rounded-3xl border border-white/10 bg-[var(--surface)]/85 px-5 py-4 backdrop-blur-xl transition-colors hover:border-[var(--accent)]/40"
        >
          <span className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-[var(--muted)]">
              <Flag className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-bold text-[var(--foreground)]">
              Full journey
            </span>
          </span>
          <span className="flex items-center gap-2 text-xs text-[var(--muted)]">
            Rank ladder, badges, history
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>

        {/* Next rank teaser keeps the target visible even at zero XP */}
        {progression.next ? (
          <div className="rounded-3xl border border-white/8 bg-white/[0.02] px-5 py-3 text-[11px] text-[var(--muted)]">
            <span className="font-bold text-[var(--foreground)]">
              {progression.next.name}
            </span>{" "}
            unlocks at {progression.next.xpRequired.toLocaleString()} XP —{" "}
            {progression.next.blurb}
          </div>
        ) : null}
      </m.div>
    </section>
  );
}
