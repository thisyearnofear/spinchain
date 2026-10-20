"use client";

/**
 * ProgressionReward — what the ride paid out.
 *
 * The payoff moment of the ladder. A ride that ranks up gets a real
 * celebration; a ride that doesn't still shows the XP it earned, because
 * every ride must move the number.
 *
 * Wedge guardrail: rider language only. XP is a score on your own ladder,
 * never a token, never cash, never a chain.
 */

import { m } from "framer-motion";
import { ChevronRight, Sparkles, TrendingUp } from "lucide-react";
import { useProgressionCelebration } from "@/app/stores/progression-store";
import { formatXp, useProgression } from "@/app/lib/progression";
import { RankEmblem, RankProgressBar } from "@/app/components/features/progression/rank-card";
import { springSnappy } from "@/app/lib/motion";
/**
 * The rank-up moment. Deliberately loud: this is the reward the whole
 * ladder is built to deliver.
 */
export function RankUpMoment({ className = "" }: { className?: string }) {
  const lastRankUp = useProgressionCelebration((s) => s.lastRankUp);
  if (!lastRankUp) return null;
  const { from, to } = lastRankUp;

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.9, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.85, ...springSnappy }}
      className={`relative w-full overflow-hidden rounded-3xl border p-5 text-center ${className}`}
      style={{
        borderColor: `${to.color}55`,
        background: `radial-gradient(120% 100% at 50% 0%, ${to.color}26 0%, rgba(7,9,15,0.9) 70%)`,
        boxShadow: `0 0 60px ${to.glow}`,
      }}
      data-testid="rank-up-moment"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${to.color}, transparent)` }}
      />
      <p
        className="text-[10px] font-black uppercase tracking-[0.4em]"
        style={{ color: to.color }}
      >
        Rank up
      </p>
      <div className="mt-3 flex items-center justify-center gap-3">
        <div className="opacity-40">
          <RankEmblem rank={from} size={44} />
        </div>
        <ChevronRight className="h-5 w-5 text-white/30" aria-hidden="true" />
        <RankEmblem rank={to} size={64} />
      </div>
      <h3 className="mt-3 text-2xl font-black tracking-tight text-white">
        {to.title}
      </h3>
      <p className="mt-1 text-xs text-white/60">{to.blurb}</p>
    </m.div>
  );
}

/**
 * The compact XP receipt — always shown after a ride, rank-up or not.
 */
export function ProgressionReceipt({ className = "" }: { className?: string }) {
  const lastEntry = useProgressionCelebration((s) => s.lastEntry);
  const progression = useProgression();

  if (!lastEntry) return null;

  const parts: { label: string; value: number }[] = [
    { label: "Time", value: lastEntry.breakdown.duration },
    { label: "Effort", value: lastEntry.breakdown.effort },
    { label: "Power", value: lastEntry.breakdown.power },
    { label: "Flow", value: lastEntry.breakdown.flow },
    { label: "Milestones", value: lastEntry.breakdown.milestones },
  ].filter((p) => p.value > 0);

  return (
    <div
      className={`w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 ${className}`}
      data-testid="progression-receipt"
    >
      <div className="flex items-center gap-3">
        <RankEmblem rank={progression.rank} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span
              className="text-lg font-black tabular-nums"
              style={{ color: progression.rank.color }}
            >
              +{lastEntry.xp} XP
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
              {progression.rank.name}
            </span>
          </div>
          <div className="mt-1.5">
            <RankProgressBar
              progress={progression.progress}
              color={progression.rank.color}
              height={5}
              shimmer={false}
            />
          </div>
        </div>
        <TrendingUp className="h-4 w-4 shrink-0 text-white/30" aria-hidden="true" />
      </div>

      {parts.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/8 pt-3">
          {parts.map((p) => (
            <li key={p.label} className="text-[10px] text-white/45">
              {p.label}{" "}
              <span className="font-bold tabular-nums text-white/75">
                +{p.value}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The "next thing you're working toward" line, shown under the receipt.
 */
export function NextRankTeaser({ className = "" }: { className?: string }) {
  const progression = useProgression();
  if (!progression.next) return null;

  return (
    <div
      className={`flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2 text-[11px] text-white/55 ${className}`}
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-bold" style={{ color: progression.next.color }}>
          {progression.next.name}
        </span>{" "}
        in {formatXp(progression.xpToNext)} XP
      </span>
    </div>
  );
}
