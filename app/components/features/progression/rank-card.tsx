"use client";

/**
 * RankCard — the rider's ladder, made visible.
 *
 * One component, three densities, one source of truth (`app/lib/progression`).
 * The front door needs a compact chip; the rider dashboard needs a card; the
 * journey page needs the full ladder. All three read from the same store so
 * they can never disagree.
 *
 * Wedge guardrails:
 *  - visible game — the ladder appears before the ride, not after
 *  - rider language only — no XP-to-token framing, no chain
 *  - one primary CTA — the card never competes with the page's main action
 */

import { m } from "framer-motion";
import { ChevronRight, Lock, Sparkles, Trophy } from "lucide-react";
import {
  RANKS,
  UNLOCKS,
  formatXp,
  formatXpExact,
  useProgression,
  type AuraTier,
  type RankDefinition,
  type UnlockDefinition,
} from "@/app/lib/progression";
import { EASE_SMOOTH } from "@/app/lib/motion";

// ─── Emblem ───────────────────────────────────────────────────────────

const AURA_GLYPH: Record<AuraTier, string> = {
  none: "",
  ember: "✦",
  flow: "≋",
  surge: "✧",
  apex: "◈",
};

/**
 * The rank emblem: a hexagonal badge carrying the rank color, the rank
 * index, and the rider's aura glyph. Pure CSS so it costs nothing to render
 * on every surface.
 */
export function RankEmblem({
  rank,
  size = 64,
  locked = false,
  className = "",
}: {
  rank: RankDefinition;
  size?: number;
  locked?: boolean;
  className?: string;
}) {
  const glyph = AURA_GLYPH[rank.aura];

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-[30%] blur-md transition-opacity"
        style={{
          background: locked ? "transparent" : rank.glow,
          opacity: locked ? 0 : 0.55,
        }}
      />
      {/* Badge body — a rounded hexagon drawn with clip-path */}
      <div
        className="absolute inset-0 grid place-items-center transition-all"
        style={{
          clipPath:
            "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
          background: locked
            ? "rgba(255,255,255,0.04)"
            : `linear-gradient(160deg, ${rank.color} 0%, ${rank.color}cc 55%, #0b1020 140%)`,
          boxShadow: locked
            ? "inset 0 0 0 1px rgba(255,255,255,0.08)"
            : `inset 0 0 0 1px rgba(255,255,255,0.28), 0 6px 24px ${rank.glow}`,
        }}
      >
        <div className="flex flex-col items-center leading-none">
          <span
            className="font-black tabular-nums tracking-tight"
            style={{
              fontSize: size * 0.36,
              color: locked ? "rgba(255,255,255,0.28)" : "#0b1020",
              textShadow: locked ? "none" : "0 1px 0 rgba(255,255,255,0.35)",
            }}
          >
            {rank.index + 1}
          </span>
          {glyph ? (
            <span
              className="mt-0.5 font-bold"
              style={{
                fontSize: size * 0.18,
                color: locked ? "rgba(255,255,255,0.22)" : "rgba(11,16,32,0.7)",
              }}
            >
              {glyph}
            </span>
          ) : null}
        </div>
      </div>
      {locked ? (
        <div className="absolute inset-0 grid place-items-center">
          <Lock className="h-3.5 w-3.5 text-white/25" />
        </div>
      ) : null}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────

export function RankProgressBar({
  progress,
  color,
  height = 8,
  className = "",
  shimmer = true,
}: {
  progress: number;
  color: string;
  height?: number;
  className?: string;
  shimmer?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  return (
    <div
      className={`relative w-full overflow-hidden rounded-full bg-white/8 ${className}`}
      style={{ height }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <m.div
        className="absolute inset-y-0 left-0 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.9, ease: EASE_SMOOTH }}
        style={{
          background: `linear-gradient(90deg, ${color}66, ${color})`,
          boxShadow: `0 0 14px ${color}`,
        }}
      />
      {shimmer ? (
        <m.div
          className="pointer-events-none absolute inset-y-0 w-16"
          animate={{ x: ["-20%", "420%"] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)",
          }}
        />
      ) : null}
    </div>
  );
}

// ─── Compact chip ─────────────────────────────────────────────────────

/**
 * RankChip — the smallest possible signal that this is a game. Used in the
 * hero, the gamification bar and the ride header.
 */
export function RankChip({
  rank,
  progress,
  className = "",
}: {
  rank: RankDefinition;
  progress?: number;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 ${className}`}
      style={{
        borderColor: `${rank.color}44`,
        background: `${rank.color}14`,
      }}
      data-testid="rank-chip"
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: rank.color, boxShadow: `0 0 8px ${rank.color}` }}
      />
      <span
        className="text-[11px] font-black uppercase tracking-[0.14em]"
        style={{ color: rank.color }}
      >
        {rank.name}
      </span>
      {progress !== undefined ? (
        <span className="text-[11px] font-semibold tabular-nums text-[var(--muted)]">
          {Math.round(progress * 100)}%
        </span>
      ) : null}
    </div>
  );
}

// ─── Unlock row ───────────────────────────────────────────────────────

function UnlockRow({
  unlock,
  unlocked,
}: {
  unlock: UnlockDefinition;
  unlocked: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs transition-colors ${
        unlocked
          ? "border-white/10 bg-white/[0.04]"
          : "border-white/5 bg-white/[0.015]"
      }`}
    >
      <span
        className="grid h-6 w-6 shrink-0 place-items-center rounded-lg"
        style={{
          background: unlocked ? "rgba(249,115,22,0.16)" : "rgba(255,255,255,0.05)",
          color: unlocked ? "var(--accent)" : "rgba(255,255,255,0.3)",
        }}
      >
        {unlocked ? (
          <Sparkles className="h-3 w-3" />
        ) : (
          <Lock className="h-3 w-3" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={`truncate font-semibold ${
            unlocked ? "text-[var(--foreground)]" : "text-[var(--muted)]"
          }`}
        >
          {unlock.label}
        </div>
        <div className="truncate text-[11px] text-[var(--muted)]/70">
          {unlock.detail}
        </div>
      </div>
      {!unlocked ? (
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]/60">
          Rank {unlock.rankIndex + 1}
        </span>
      ) : null}
    </div>
  );
}

// ─── Full card ────────────────────────────────────────────────────────

/**
 * RankCard — the dashboard's progression panel.
 *
 * Shows where the rider stands, the gap to the next rank, and the next
 * thing the ladder gives them. Deliberately not a wall of numbers: one
 * rank, one bar, one unlock.
 */
export function RankCard({
  className = "",
  showLadder = false,
}: {
  className?: string;
  showLadder?: boolean;
}) {
  const progression = useProgression();
  const { rank, next, progress, nextUnlock: upcoming } = progression;

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-[var(--surface)]/85 p-5 backdrop-blur-xl ${className}`}
      data-testid="rank-card"
    >
      {/* Rank-colored wash */}
      <div
        className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full blur-3xl"
        style={{ background: rank.glow, opacity: 0.45 }}
      />

      <div className="relative flex items-start gap-4">
        <RankEmblem rank={rank} size={68} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[11px] font-black uppercase tracking-[0.2em]"
              style={{ color: rank.color }}
            >
              Rank {rank.index + 1} · {formatXp(progression.totalXp)} XP
            </span>
          </div>
          <h3 className="mt-1 text-2xl font-black tracking-tight text-[var(--foreground)]">
            {rank.title}
          </h3>
          <p className="mt-1 text-xs text-[var(--muted)]">{rank.blurb}</p>
        </div>
      </div>

      {/* Progress to next rank */}
      <div className="relative mt-5">
        <div className="mb-2 flex items-baseline justify-between text-xs">
          <span className="font-semibold text-[var(--muted)]">
            {next ? (
              <>
                {formatXp(progression.xpToNext)} XP to{" "}
                <span style={{ color: next.color }}>{next.name}</span>
              </>
            ) : (
              "Top of the ladder"
            )}
          </span>
          <span className="tabular-nums text-[var(--muted)]/70">
            {formatXpExact(progression.totalXp)}
            {next ? ` / ${formatXpExact(next.xpRequired)}` : ""}
          </span>
        </div>
        <RankProgressBar progress={progress} color={rank.color} />
      </div>

      {/* Next unlock */}
      {upcoming ? (
        <div className="relative mt-5 flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
            style={{
              background: "rgba(255,255,255,0.05)",
              color: upcoming.rankIndex <= rank.index ? "var(--accent)" : "var(--muted)",
            }}
          >
            {upcoming.kind === "world" ? (
              <Sparkles className="h-4 w-4" />
            ) : (
              <Trophy className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]/70">
              Next unlock
            </div>
            <div className="truncate text-sm font-bold text-[var(--foreground)]">
              {upcoming.label}
            </div>
            <div className="truncate text-[11px] text-[var(--muted)]">
              Unlocks at rank {upcoming.rankIndex + 1}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted)]/50" />
        </div>
      ) : (
        <div className="relative mt-5 flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
            <Trophy className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)]/70">
              Ladder complete
            </div>
            <div className="truncate text-sm font-bold text-[var(--foreground)]">
              {rank.title} — nothing left to earn
            </div>
          </div>
        </div>
      )}

      {showLadder ? <RankLadder className="relative mt-5" /> : null}
    </section>
  );
}

// ─── Ladder ───────────────────────────────────────────────────────────

/**
 * RankLadder — the whole climb, top to bottom, with the rider's position
 * marked. Shown on the journey page and (optionally) inside the rank card.
 */
export function RankLadder({ className = "" }: { className?: string }) {
  const { rankIndex, totalXp } = useProgression();

  return (
    <ol className={`space-y-1.5 ${className}`} data-testid="rank-ladder">
      {RANKS.map((r) => {
        const unlocked = r.index <= rankIndex;
        const current = r.index === rankIndex;
        return (
          <li
            key={r.index}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
              current
                ? "border-white/15 bg-white/[0.06]"
                : unlocked
                  ? "border-white/8 bg-white/[0.02]"
                  : "border-white/5 bg-transparent"
            }`}
          >
            <RankEmblem rank={r} size={30} locked={!unlocked} />
            <div className="min-w-0 flex-1">
              <div
                className={`text-sm font-bold ${
                  unlocked ? "text-[var(--foreground)]" : "text-[var(--muted)]/60"
                }`}
              >
                {r.name}
              </div>
              <div className="text-[11px] text-[var(--muted)]/70">
                {unlocked
                  ? current
                    ? `You are here · ${formatXp(totalXp)} XP`
                    : "Reached"
                  : `${formatXp(r.xpRequired)} XP`}
              </div>
            </div>
            {current ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                style={{
                  background: `${r.color}22`,
                  color: r.color,
                }}
              >
                Now
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Unlock grid ──────────────────────────────────────────────────────

/** All unlocks with their state — used on the journey page. */
export function UnlockGrid({ className = "" }: { className?: string }) {
  const { rankIndex } = useProgression();
  return (
    <div className={`grid gap-2 sm:grid-cols-2 ${className}`}>
      {UNLOCKS.map((unlock) => (
        <UnlockRow
          key={unlock.id}
          unlock={unlock}
          unlocked={unlock.rankIndex <= rankIndex}
        />
      ))}
    </div>
  );
}
