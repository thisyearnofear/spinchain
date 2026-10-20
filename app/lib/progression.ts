/**
 * Progression — the rider's long arc from "Spark" to "Singularity".
 *
 * The game already tracks a lot: streaks, flow tiers, session milestones,
 * personal bests. What it never had was a *ladder* — a single number the
 * rider watches climb that turns every ride into movement toward something.
 * This module is that ladder.
 *
 * Design constraints (see docs/WEDGE.md):
 *  - Rider-facing language only. No XP-to-token framing, no cash, no chain.
 *  - Local-first and receipt-shaped: an append-only ledger of what was
 *    earned and why, so a rider's history can be audited or exported.
 *  - Derived, not duplicated: XP is computed from what the ride already
 *    recorded (duration, effort, power, flow, milestones). Nothing new is
 *    invented, so existing riders keep their history for free.
 *
 * Storage: localStorage key `spinchain:progression:v1` — an append-only
 * ledger of award entries plus the derived totals. Backed by the existing
 * `spinchain:rides:history:v2` summaries when the ledger is empty, so a
 * rider who was here before the ladder existed still starts in the right
 * place instead of at zero.
 */

// ─── Ranks ────────────────────────────────────────────────────────────

export type AuraTier = "none" | "ember" | "flow" | "surge" | "apex";

export interface RankDefinition {
  /** Position on the ladder, 0-based. */
  index: number;
  /** Short rank name — the headline word. */
  name: string;
  /** Full title, e.g. "Ember Rider". */
  title: string;
  /** Cumulative XP required to hold this rank. */
  xpRequired: number;
  /** Primary accent color for the rank emblem and progress bar. */
  color: string;
  /** Soft glow color used for embers and highlights. */
  glow: string;
  /** Rider aura tier unlocked at this rank. */
  aura: AuraTier;
  /** One line of rider-facing copy for the rank reveal. */
  blurb: string;
}

/**
 * The ladder. Thresholds are tuned so a solid 40-minute ride (≈350–450 XP)
 * lands roughly one rank per ride early on, tapering to one rank per three
 * or four rides at the top. Twenty good rides should feel like a journey,
 * not a grind.
 */
export const RANKS: RankDefinition[] = [
  {
    index: 0,
    name: "Spark",
    title: "Spark Rider",
    xpRequired: 0,
    color: "#f97316",
    glow: "rgba(249, 115, 22, 0.45)",
    aura: "none",
    blurb: "The road remembers you now.",
  },
  {
    index: 1,
    name: "Ember",
    title: "Ember Rider",
    xpRequired: 300,
    color: "#fb923c",
    glow: "rgba(251, 146, 60, 0.45)",
    aura: "ember",
    blurb: "Something is catching. Keep feeding it.",
  },
  {
    index: 2,
    name: "Flow",
    title: "Flow Rider",
    xpRequired: 750,
    color: "#38bdf8",
    glow: "rgba(56, 189, 248, 0.45)",
    aura: "flow",
    blurb: "You ride the line instead of chasing it.",
  },
  {
    index: 3,
    name: "Surge",
    title: "Surge Rider",
    xpRequired: 1300,
    color: "#22d3ee",
    glow: "rgba(34, 211, 238, 0.45)",
    aura: "surge",
    blurb: "The peaks come faster now — and you take them.",
  },
  {
    index: 4,
    name: "Tempo",
    title: "Tempo Rider",
    xpRequired: 2000,
    color: "#34d399",
    glow: "rgba(52, 211, 153, 0.45)",
    aura: "surge",
    blurb: "Sustained. Controlled. Ruthless.",
  },
  {
    index: 5,
    name: "Vector",
    title: "Vector Rider",
    xpRequired: 2900,
    color: "#a3e635",
    glow: "rgba(163, 230, 53, 0.45)",
    aura: "apex",
    blurb: "Every watt lands where you aimed it.",
  },
  {
    index: 6,
    name: "Apex",
    title: "Apex Rider",
    xpRequired: 4000,
    color: "#fbbf24",
    glow: "rgba(251, 191, 36, 0.45)",
    aura: "apex",
    blurb: "The top of the wall is a place you have been.",
  },
  {
    index: 7,
    name: "Zenith",
    title: "Zenith Rider",
    xpRequired: 5300,
    color: "#fb7185",
    glow: "rgba(251, 113, 133, 0.45)",
    aura: "apex",
    blurb: "Above the noise. Below the effort.",
  },
  {
    index: 8,
    name: "Mythic",
    title: "Mythic Rider",
    xpRequired: 6800,
    color: "#e879f9",
    glow: "rgba(232, 121, 249, 0.45)",
    aura: "apex",
    blurb: "The world bends to hold your pace.",
  },
  {
    index: 9,
    name: "Singularity",
    title: "Singularity Rider",
    xpRequired: 8500,
    color: "#f472b6",
    glow: "rgba(244, 114, 182, 0.5)",
    aura: "apex",
    blurb: "There is no road left. Only cadence.",
  },
];

export const MAX_RANK_INDEX = RANKS.length - 1;

/** The rank that holds a given cumulative XP total. */
export function rankForXp(totalXp: number): RankDefinition {
  const xp = Number.isFinite(totalXp) ? Math.max(0, totalXp) : 0;
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (xp >= rank.xpRequired) current = rank;
    else break;
  }
  return current;
}

/** The next rank up, or null at the top of the ladder. */
export function nextRank(rankIndex: number): RankDefinition | null {
  return rankIndex < MAX_RANK_INDEX ? RANKS[rankIndex + 1] : null;
}

// ─── Unlocks ──────────────────────────────────────────────────────────

export type UnlockKind = "world" | "aura" | "title";

export interface UnlockDefinition {
  id: string;
  kind: UnlockKind;
  /** Rank index required to unlock. */
  rankIndex: number;
  /** Cumulative XP at which this unlock opens. */
  xpRequired: number;
  label: string;
  detail: string;
}

/**
 * The unlock catalog. Worlds are the big prize; aura tiers are what the
 * rider wears in the 3D world; titles are the name under their name.
 *
 * `world` ids match the visualizer theme keys in
 * `app/components/features/route/visualizer-theme.ts`.
 */
export const UNLOCKS: UnlockDefinition[] = [
  {
    id: "world:neon",
    kind: "world",
    rankIndex: 0,
    xpRequired: 0,
    label: "Neon City",
    detail: "Your first world. Every ride starts here.",
  },
  {
    id: "aura:ember",
    kind: "aura",
    rankIndex: 1,
    xpRequired: 300,
    label: "Ember Aura",
    detail: "A warm ring of light trails your wheels.",
  },
  {
    id: "world:alpine",
    kind: "world",
    rankIndex: 1,
    xpRequired: 300,
    label: "Summit Pass",
    detail: "Cold air, thin light, long climbs.",
  },
  {
    id: "aura:flow",
    kind: "aura",
    rankIndex: 2,
    xpRequired: 750,
    label: "Flow Aura",
    detail: "The world starts moving with you.",
  },
  {
    id: "world:mars",
    kind: "world",
    rankIndex: 2,
    xpRequired: 750,
    label: "Red Expanse",
    detail: "Rust, dust and a sky that burns.",
  },
  {
    id: "world:anime",
    kind: "world",
    rankIndex: 3,
    xpRequired: 1300,
    label: "Toon Valley",
    detail: "Pastel hills and blossom in the wind.",
  },
  {
    id: "aura:surge",
    kind: "aura",
    rankIndex: 3,
    xpRequired: 1300,
    label: "Surge Aura",
    detail: "Rings of light that peak when you do.",
  },
  {
    id: "world:rainbow",
    kind: "world",
    rankIndex: 5,
    xpRequired: 2900,
    label: "Spectrum Run",
    detail: "Prismatic night. The top of the ladder.",
  },
  {
    id: "aura:apex",
    kind: "aura",
    rankIndex: 5,
    xpRequired: 2900,
    label: "Apex Aura",
    detail: "The rider and the road become one surface.",
  },
];

/** Unlocks a rider has earned by holding `rankIndex`. */
export function unlocksForRank(rankIndex: number): UnlockDefinition[] {
  return UNLOCKS.filter((u) => u.rankIndex <= rankIndex);
}

/** The single most motivating next unlock — the next one above the rider. */
export function nextUnlock(rankIndex: number): UnlockDefinition | null {
  const ordered = [...UNLOCKS].sort((a, b) => a.rankIndex - b.rankIndex);
  return ordered.find((u) => u.rankIndex > rankIndex) ?? null;
}

/** True when the rider's rank grants this unlock id. */
export function hasUnlock(rankIndex: number, unlockId: string): boolean {
  const def = UNLOCKS.find((u) => u.id === unlockId);
  return !!def && def.rankIndex <= rankIndex;
}

// ─── Worlds ───────────────────────────────────────────────────────────

/**
 * The unlock that gates a world, or null when the world is always open.
 * `themeKey` matches the visualizer theme keys (neon, alpine, mars, anime,
 * rainbow).
 */
export function worldUnlock(themeKey: string): UnlockDefinition | null {
  return (
    UNLOCKS.find((u) => u.kind === "world" && u.id === `world:${themeKey}`) ??
    null
  );
}

/** True when the rider's rank grants access to this world. */
export function isWorldUnlocked(rankIndex: number, themeKey: string): boolean {
  const unlock = worldUnlock(themeKey);
  return !unlock || unlock.rankIndex <= rankIndex;
}

/**
 * A world the rider has already ridden stays open forever.
 *
 * The rank gate is the ladder's teeth, but it must never take something
 * away that the rider already had. Once you have ridden Toon Valley, it is
 * yours — the ladder only gates worlds you have never seen.
 */
export function isWorldUnlockedForRider(
  rankIndex: number,
  themeKey: string,
  riddenWorlds: readonly string[] = [],
): boolean {
  if (riddenWorlds.includes(themeKey)) return true;
  return isWorldUnlocked(rankIndex, themeKey);
}

// ─── XP computation ───────────────────────────────────────────────────

export interface RideXpInput {
  /** Total ride duration in seconds. */
  durationSec: number;
  /** Average power in watts. */
  avgPower: number;
  /** Average effort score, 0–1000. */
  avgEffort: number;
  /** Minutes spent at flow tier >= 2. */
  flowMinutes: number;
  /** Highest flow tier reached (0–4). */
  peakFlowTier: number;
  /** Number of session milestones earned on the ride. */
  milestoneCount: number;
  /** Current daily streak length, for the consistency bonus. */
  streakDays: number;
}

export interface RideXpBreakdown {
  duration: number;
  effort: number;
  power: number;
  flow: number;
  tier: number;
  milestones: number;
  streak: number;
  total: number;
}

/** Per-component XP weights. Kept in one place so tuning is one edit. */
export const XP_WEIGHTS = {
  /** XP per minute ridden. */
  durationPerMinute: 3,
  /** XP per point of average effort (0–1000), capped at `effortCap`. */
  effortPerPoint: 0.03,
  effortCap: 30,
  /** XP per watt of average power, capped at `powerCap`. */
  powerPerWatt: 0.1,
  powerCap: 48,
  /** XP per minute spent in flow. */
  flowPerMinute: 12,
  /** XP per flow tier reached. */
  perFlowTier: 20,
  /** XP per session milestone earned. */
  perMilestone: 25,
  /** XP per day of streak, capped at `streakCap`. */
  perStreakDay: 10,
  streakCap: 50,
} as const;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * XP for a single ride. Every component is something the rider actually did
 * — time on the bike, effort, power, time in flow, milestones hit, and
 * consistency. Nothing is awarded for showing up.
 */
export function computeRideXp(input: RideXpInput): RideXpBreakdown {
  const minutes = clamp(input.durationSec, 0, 24 * 60) / 60;

  const duration = Math.round(minutes * XP_WEIGHTS.durationPerMinute);
  const effort = Math.round(
    clamp(input.avgEffort, 0, 1000) * XP_WEIGHTS.effortPerPoint,
  );
  const power = Math.round(
    clamp(input.avgPower, 0, 600) * XP_WEIGHTS.powerPerWatt,
  );
  const flow = Math.round(
    clamp(input.flowMinutes, 0, 600) * XP_WEIGHTS.flowPerMinute,
  );
  const tier = clamp(input.peakFlowTier, 0, 4) * XP_WEIGHTS.perFlowTier;
  const milestones =
    clamp(input.milestoneCount, 0, 24) * XP_WEIGHTS.perMilestone;
  const streak = Math.round(
    clamp(input.streakDays, 0, 30) * XP_WEIGHTS.perStreakDay,
  );

  const total =
    duration + effort + power + flow + tier + milestones + streak;

  return { duration, effort, power, flow, tier, milestones, streak, total };
}

// ─── Ledger ───────────────────────────────────────────────────────────

export interface ProgressionEntry {
  id: string;
  /** Epoch ms the award was recorded. */
  at: number;
  /** Ride summary id, when the entry came from a live ride. */
  rideId?: string;
  /** The world the ride happened in, when known. */
  world?: string;
  /** Total XP granted by this entry. */
  xp: number;
  /** Component breakdown, for an auditable "why did I get that". */
  breakdown: RideXpBreakdown;
  /** Rank index held after this entry was applied. */
  rankAfter: number;
  /** True when the entry was reconstructed from pre-existing ride history. */
  backfilled?: boolean;
}

export interface ProgressionLedger {
  version: number;
  entries: ProgressionEntry[];
  totalXp: number;
  /** Distinct worlds the rider has ridden. A ridden world stays unlocked. */
  worlds: string[];
  /** True once we have reconstructed history from the ride ledger. */
  backfilled: boolean;
}

export const PROGRESSION_STORAGE_KEY = "spinchain:progression:v1";
const PROGRESSION_STORAGE_VERSION = 1;

function createDefaultLedger(): ProgressionLedger {
  return {
    version: PROGRESSION_STORAGE_VERSION,
    entries: [],
    totalXp: 0,
    worlds: [],
    backfilled: false,
  };
}

function loadLedger(): ProgressionLedger {
  if (typeof localStorage === "undefined") return createDefaultLedger();
  try {
    const raw = localStorage.getItem(PROGRESSION_STORAGE_KEY);
    if (!raw) return createDefaultLedger();
    const parsed = JSON.parse(raw) as Partial<ProgressionLedger>;
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    const totalXp =
      typeof parsed.totalXp === "number" && Number.isFinite(parsed.totalXp)
        ? parsed.totalXp
        : entries.reduce((sum, e) => sum + (e.xp || 0), 0);
    const worlds = Array.isArray(parsed.worlds)
      ? parsed.worlds.filter((w): w is string => typeof w === "string")
      : entries
          .map((e) => e.world)
          .filter((w): w is string => typeof w === "string");
    return {
      version: PROGRESSION_STORAGE_VERSION,
      entries,
      totalXp,
      worlds,
      backfilled: parsed.backfilled === true,
    };
  } catch {
    return createDefaultLedger();
  }
}

function saveLedger(ledger: ProgressionLedger): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(ledger));
  } catch {
    // Storage unavailable — the in-memory ledger still works for this session.
  }
}

// ─── Progression state ────────────────────────────────────────────────

export interface ProgressionState {
  totalXp: number;
  rank: RankDefinition;
  rankIndex: number;
  next: RankDefinition | null;
  /** XP earned inside the current rank. */
  xpIntoRank: number;
  /** XP span of the current rank (0 for the top rank). */
  xpSpan: number;
  /** XP still needed to reach the next rank (0 at the top). */
  xpToNext: number;
  /** 0–1 progress through the current rank. */
  progress: number;
  /** The next unlock above the rider's rank, if any. */
  nextUnlock: UnlockDefinition | null;
  /** Unlocks the rider has earned. */
  unlocks: UnlockDefinition[];
  /** Aura tier granted by the rider's rank. */
  aura: AuraTier;
  /** Distinct worlds the rider has ridden — these stay unlocked forever. */
  worlds: string[];
  entries: ProgressionEntry[];
}

export function deriveProgression(ledger: ProgressionLedger): ProgressionState {
  const totalXp = Math.max(0, ledger.totalXp || 0);
  const rank = rankForXp(totalXp);
  const next = nextRank(rank.index);
  const xpIntoRank = totalXp - rank.xpRequired;
  const xpSpan = next ? next.xpRequired - rank.xpRequired : 0;
  const xpToNext = next ? Math.max(0, next.xpRequired - totalXp) : 0;
  const progress = next && xpSpan > 0 ? Math.min(1, xpIntoRank / xpSpan) : 1;
  const unlocks = unlocksForRank(rank.index);

  return {
    totalXp,
    rank,
    rankIndex: rank.index,
    next,
    xpIntoRank,
    xpSpan,
    xpToNext,
    progress,
    nextUnlock: nextUnlock(rank.index),
    unlocks,
    aura: rank.aura,
    worlds: ledger.worlds ?? [],
    entries: ledger.entries,
  };
}

// ─── Store ────────────────────────────────────────────────────────────

export class ProgressionStore {
  private ledger: ProgressionLedger;
  private listeners = new Set<() => void>();

  constructor() {
    this.ledger = loadLedger();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify() {
    saveLedger(this.ledger);
    this.listeners.forEach((fn) => fn());
  }

  getLedger(): ProgressionLedger {
    return {
      ...this.ledger,
      entries: [...this.ledger.entries],
    };
  }

  getState(): ProgressionState {
    return deriveProgression(this.ledger);
  }

  /**
   * Award XP for a ride. Returns the entry plus the rank transition so the
   * completion screen can celebrate a rank-up without recomputing.
   *
   * `world` is the visualizer theme the ride happened in. Recording it means
   * a world the rider has ridden stays unlocked for them forever.
   */
  award(input: RideXpInput, rideId?: string, world?: string): {
    entry: ProgressionEntry;
    state: ProgressionState;
    previousRankIndex: number;
    rankedUp: boolean;
  } {
    const previousRankIndex = this.getState().rankIndex;
    const breakdown = computeRideXp(input);
    const at = Date.now();

    const entry: ProgressionEntry = {
      id: `${at}-${this.ledger.entries.length}`,
      at,
      rideId,
      world,
      xp: breakdown.total,
      breakdown,
      rankAfter: previousRankIndex,
    };

    this.ledger.entries.push(entry);
    this.ledger.totalXp += breakdown.total;
    if (world && !this.ledger.worlds.includes(world)) {
      this.ledger.worlds.push(world);
    }
    entry.rankAfter = rankForXp(this.ledger.totalXp).index;
    this.notify();

    const state = this.getState();
    return {
      entry,
      state,
      previousRankIndex,
      rankedUp: state.rankIndex > previousRankIndex,
    };
  }

  /**
   * Reconstruct a starting total from pre-existing ride history so riders
   * who joined before the ladder existed don't restart at zero. Uses only
   * the ride summaries that already exist — no flow/milestone data is
   * invented, so the backfill is a floor, not a guess.
   *
   * Practice rides were named after their world ("Red Expanse"), so the
   * backfill also recovers which worlds the rider has already ridden. Those
   * stay unlocked even if their rank wouldn't have opened them yet.
   */
  backfillFromHistory(
    rides: {
      id?: string;
      completedAt?: number;
      durationSec?: number;
      avgPower?: number;
      avgEffort?: number;
      className?: string;
    }[],
    worldLabels: Record<string, string> = {},
  ): ProgressionEntry | null {
    if (this.ledger.entries.length > 0) return null;

    const valid = rides.filter((r) => (r.durationSec ?? 0) > 0);
    if (valid.length === 0) {
      // Mark as attempted so we don't scan on every mount.
      this.ledger.backfilled = true;
      this.notify();
      return null;
    }

    // Recover ridden worlds from ride names.
    for (const ride of rides) {
      const name = ride.className?.trim();
      if (!name) continue;
      for (const [key, label] of Object.entries(worldLabels)) {
        if (name === label && !this.ledger.worlds.includes(key)) {
          this.ledger.worlds.push(key);
        }
      }
    }

    const breakdown = valid.reduce<{
      duration: number;
      effort: number;
      power: number;
      flow: number;
      tier: number;
      milestones: number;
      streak: number;
      total: number;
    }>(
      (acc, ride) => {
        const xp = computeRideXp({
          durationSec: ride.durationSec ?? 0,
          avgPower: ride.avgPower ?? 0,
          avgEffort: ride.avgEffort ?? 0,
          flowMinutes: 0,
          peakFlowTier: 0,
          milestoneCount: 0,
          streakDays: 0,
        });
        acc.duration += xp.duration;
        acc.effort += xp.effort;
        acc.power += xp.power;
        acc.total += xp.total;
        return acc;
      },
      {
        duration: 0,
        effort: 0,
        power: 0,
        flow: 0,
        tier: 0,
        milestones: 0,
        streak: 0,
        total: 0,
      },
    );

    const at = valid.reduce(
      (latest, r) => Math.max(latest, r.completedAt ?? 0),
      0,
    );

    const entry: ProgressionEntry = {
      id: `backfill-${valid.length}`,
      at,
      xp: breakdown.total,
      breakdown,
      rankAfter: 0,
      backfilled: true,
    };

    this.ledger.entries.push(entry);
    this.ledger.totalXp += breakdown.total;
    this.ledger.backfilled = true;
    entry.rankAfter = rankForXp(this.ledger.totalXp).index;
    this.notify();

    return entry;
  }

  reset() {
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem(PROGRESSION_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    this.ledger = createDefaultLedger();
    this.notify();
  }
}

export const progressionStore = new ProgressionStore();

// ─── React hook ───────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";

/**
 * Reconstruct the starting total from the pre-existing ride ledger, once.
 * Called by `useProgression` on mount so any surface that shows the ladder
 * agrees on the rider's starting point.
 */
function ensureBackfill(): void {
  if (typeof window === "undefined") return;
  if (progressionStore.getLedger().backfilled) return;
  // Imported lazily: ride-history touches browser storage and is not
  // needed by the pure ledger code above.
  void import("@/app/lib/analytics/ride-history")
    .then(async ({ getRideHistory }) => {
      if (progressionStore.getLedger().backfilled) return;
      // World labels let the backfill recover which worlds the rider has
      // already ridden — practice rides were named after their world.
      const { VISUALIZER_THEMES } = await import(
        "@/app/components/features/route/visualizer-theme"
      );
      const labels: Record<string, string> = {};
      for (const [key, theme] of Object.entries(VISUALIZER_THEMES)) {
        labels[key] = (theme as { worldLabel: string }).worldLabel;
      }
      progressionStore.backfillFromHistory(getRideHistory(), labels);
    })
    .catch(() => {
      // No history available (or storage blocked) — the ladder still works,
      // it just starts from zero.
    });
}

export function useProgression(): ProgressionState & {
  refresh: () => void;
} {
  const [state, setState] = useState<ProgressionState>(() =>
    progressionStore.getState(),
  );

  const refresh = useCallback(() => {
    setState(progressionStore.getState());
  }, []);

  useEffect(() => {
    ensureBackfill();
    refresh();
    return progressionStore.subscribe(refresh);
  }, [refresh]);

  return { ...state, refresh };
}

/**
 * World access for the current rider.
 *
 * Worlds are the ladder's biggest prize, so they gate on rank — but the
 * gate is a *motivating* and *fair* one: a locked world still renders, still
 * previews, always tells the rider exactly how much XP stands between them
 * and the door, and never takes back a world they have already ridden.
 */
export function useWorldAccess() {
  const { rankIndex, rank, totalXp, next, worlds } = useProgression();

  const isUnlocked = useCallback(
    (themeKey: string) =>
      isWorldUnlockedForRider(rankIndex, themeKey, worlds),
    [rankIndex, worlds],
  );

  return {
    rankIndex,
    rank,
    totalXp,
    next,
    worlds,
    unlockFor: worldUnlock,
    isUnlocked,
    /** True when the world is open because the rider has ridden it. */
    hasRidden: (themeKey: string) => worlds.includes(themeKey),
    /** XP still required for a locked world (0 when it is already open). */
    xpRemainingFor: (themeKey: string) => {
      if (isUnlocked(themeKey)) return 0;
      const unlock = worldUnlock(themeKey);
      if (!unlock) return 0;
      return Math.max(0, unlock.xpRequired - totalXp);
    },
  };
}

/** Rider-facing formatter: 1,240 → "1.2k". */
export function formatXp(xp: number): string {
  if (!Number.isFinite(xp)) return "0";
  const value = Math.round(xp);
  if (value < 1000) return String(value);
  return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`;
}

/**
 * Exact rider-facing formatter: 1263 → "1,263".
 * Used wherever two numbers are compared (progress against a threshold),
 * because a compact "1.3k / 1.3k" hides the gap.
 */
export function formatXpExact(xp: number): string {
  if (!Number.isFinite(xp)) return "0";
  return Math.round(xp).toLocaleString("en-US");
}
