import { describe, it, expect } from "vitest";
import {
  RANKS,
  UNLOCKS,
  computeRideXp,
  deriveProgression,
  formatXp,
  formatXpExact,
  isWorldUnlocked,
  isWorldUnlockedForRider,
  nextRank,
  nextUnlock,
  rankForXp,
  unlocksForRank,
  worldUnlock,
  ProgressionStore,
  type ProgressionLedger,
} from "@/app/lib/progression";

function ledgerWith(xp: number, worlds: string[] = []): ProgressionLedger {
  return { version: 1, entries: [], totalXp: xp, worlds, backfilled: true };
}

describe("progression — the rank ladder", () => {
  it("starts every rider at Spark and never below it", () => {
    expect(rankForXp(0).name).toBe("Spark");
    expect(rankForXp(-50).name).toBe("Spark");
    expect(rankForXp(Number.NaN).name).toBe("Spark");
  });

  it("holds a rank until the next threshold, then promotes", () => {
    const ember = RANKS[1];
    expect(rankForXp(ember.xpRequired - 1).name).toBe("Spark");
    expect(rankForXp(ember.xpRequired).name).toBe("Ember");
  });

  it("tops out at the last rank and has no next rank above it", () => {
    const top = RANKS[RANKS.length - 1];
    expect(rankForXp(top.xpRequired + 100_000).index).toBe(top.index);
    expect(nextRank(top.index)).toBeNull();
  });

  it("keeps thresholds strictly increasing", () => {
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].xpRequired).toBeGreaterThan(RANKS[i - 1].xpRequired);
    }
  });
});

describe("progression — XP from a ride", () => {
  it("awards nothing for a ride that did not happen", () => {
    const xp = computeRideXp({
      durationSec: 0,
      avgPower: 0,
      avgEffort: 0,
      flowMinutes: 0,
      peakFlowTier: 0,
      milestoneCount: 0,
      streakDays: 0,
    });
    expect(xp.total).toBe(0);
  });

  it("rewards time, effort, power, flow, tiers and milestones", () => {
    const xp = computeRideXp({
      durationSec: 1800,
      avgPower: 200,
      avgEffort: 500,
      flowMinutes: 10,
      peakFlowTier: 3,
      milestoneCount: 2,
      streakDays: 0,
    });
    expect(xp.duration).toBeGreaterThan(0);
    expect(xp.effort).toBeGreaterThan(0);
    expect(xp.power).toBeGreaterThan(0);
    expect(xp.flow).toBeGreaterThan(0);
    expect(xp.tier).toBeGreaterThan(0);
    expect(xp.milestones).toBeGreaterThan(0);
    expect(xp.total).toBe(
      xp.duration + xp.effort + xp.power + xp.flow + xp.tier + xp.milestones,
    );
  });

  it("caps every component so a bogus reading cannot farm the ladder", () => {
    const xp = computeRideXp({
      durationSec: 60 * 60 * 24,
      avgPower: 100_000,
      avgEffort: 100_000,
      flowMinutes: 100_000,
      peakFlowTier: 99,
      milestoneCount: 999,
      streakDays: 999,
    });
    const capped = computeRideXp({
      durationSec: 60 * 60 * 24,
      avgPower: 600,
      avgEffort: 1000,
      flowMinutes: 600,
      peakFlowTier: 4,
      milestoneCount: 24,
      streakDays: 30,
    });
    expect(xp.total).toBe(capped.total);
  });

  it("never awards negative XP for negative or invalid readings", () => {
    const xp = computeRideXp({
      durationSec: -100,
      avgPower: -50,
      avgEffort: -10,
      flowMinutes: -5,
      peakFlowTier: -3,
      milestoneCount: -2,
      streakDays: -1,
    });
    expect(xp.total).toBe(0);
  });

  it("pays more for a harder ride than an easier one of the same length", () => {
    const easy = computeRideXp({
      durationSec: 1800,
      avgPower: 90,
      avgEffort: 200,
      flowMinutes: 0,
      peakFlowTier: 0,
      milestoneCount: 0,
      streakDays: 0,
    });
    const hard = computeRideXp({
      durationSec: 1800,
      avgPower: 260,
      avgEffort: 700,
      flowMinutes: 8,
      peakFlowTier: 3,
      milestoneCount: 3,
      streakDays: 4,
    });
    expect(hard.total).toBeGreaterThan(easy.total * 2);
  });
});

describe("progression — derived state", () => {
  it("reports the gap to the next rank and a 0–1 progress value", () => {
    const rank = RANKS[1];
    const mid = rank.xpRequired + Math.floor((RANKS[2].xpRequired - rank.xpRequired) / 2);
    const state = deriveProgression(ledgerWith(mid));
    expect(state.rank.index).toBe(1);
    expect(state.next?.index).toBe(2);
    expect(state.xpToNext).toBe(RANKS[2].xpRequired - mid);
    expect(state.progress).toBeGreaterThan(0.4);
    expect(state.progress).toBeLessThan(0.6);
  });

  it("reports a full bar and no gap at the top of the ladder", () => {
    const top = RANKS[RANKS.length - 1];
    const state = deriveProgression(ledgerWith(top.xpRequired));
    expect(state.next).toBeNull();
    expect(state.xpToNext).toBe(0);
    expect(state.progress).toBe(1);
  });
});

describe("progression — unlocks", () => {
  it("gives every world an unlock entry except none, and gates them by rank", () => {
    expect(worldUnlock("neon")?.rankIndex).toBe(0);
    expect(worldUnlock("rainbow")?.rankIndex).toBeGreaterThan(0);
    expect(isWorldUnlocked(0, "neon")).toBe(true);
    expect(isWorldUnlocked(0, "alpine")).toBe(false);
    expect(isWorldUnlocked(RANKS.length - 1, "rainbow")).toBe(true);
  });

  it("opens a world exactly at the rank that lists it", () => {
    for (const unlock of UNLOCKS.filter((u) => u.kind === "world")) {
      const key = unlock.id.replace("world:", "");
      expect(isWorldUnlocked(unlock.rankIndex - 1, key)).toBe(false);
      expect(isWorldUnlocked(unlock.rankIndex, key)).toBe(true);
    }
  });

  it("always names a next unlock below the top and none above it", () => {
    expect(nextUnlock(0)).not.toBeNull();
    expect(nextUnlock(RANKS.length - 1)).toBeNull();
  });

  it("grants the world unlock and the aura unlock together at that rank", () => {
    const alpine = worldUnlock("alpine")!;
    const granted = unlocksForRank(alpine.rankIndex);
    expect(granted.some((u) => u.id === "world:alpine")).toBe(true);
    expect(granted.some((u) => u.kind === "aura")).toBe(true);
  });

  it("never locks a world the rider has already ridden", () => {
    // Rank 0 has not earned Toon Valley…
    expect(isWorldUnlocked(0, "anime")).toBe(false);
    // …but a rider who has ridden it keeps it.
    expect(isWorldUnlockedForRider(0, "anime", ["anime"])).toBe(true);
    expect(isWorldUnlockedForRider(0, "rainbow", ["anime"])).toBe(false);
  });

  it("carries ridden worlds through the derived state", () => {
    const state = deriveProgression(ledgerWith(0, ["mars"]));
    expect(state.worlds).toEqual(["mars"]);
    expect(state.rankIndex).toBe(0);
  });
});

describe("progression — the ledger store", () => {
  it("backfills XP from ride history and recovers ridden worlds by name", () => {
    const store = new ProgressionStore();
    const entry = store.backfillFromHistory(
      [
        {
          id: "a",
          completedAt: 1000,
          durationSec: 1800,
          avgPower: 200,
          avgEffort: 500,
          className: "Red Expanse",
        },
        {
          id: "b",
          completedAt: 2000,
          durationSec: 1800,
          avgPower: 200,
          avgEffort: 500,
          className: "Neon City",
        },
      ],
      { neon: "Neon City", mars: "Red Expanse" },
    );

    expect(entry).not.toBeNull();
    expect(entry?.backfilled).toBe(true);
    expect(entry?.xp).toBeGreaterThan(0);
    // Practice rides were named after their world — those worlds are ridden.
    expect(store.getLedger().worlds).toEqual(["mars", "neon"]);
    expect(store.getState().totalXp).toBe(entry?.xp);
  });

  it("records the world a live ride happened in", () => {
    const store = new ProgressionStore();
    store.award(
      {
        durationSec: 600,
        avgPower: 150,
        avgEffort: 300,
        flowMinutes: 1,
        peakFlowTier: 1,
        milestoneCount: 0,
        streakDays: 0,
      },
      undefined,
      "rainbow",
    );
    expect(store.getLedger().worlds).toContain("rainbow");
  });
});

describe("progression — formatting", () => {
  it("compacts thousands but keeps exact values available", () => {
    expect(formatXp(0)).toBe("0");
    expect(formatXp(940)).toBe("940");
    expect(formatXp(1263)).toBe("1.3k");
    expect(formatXpExact(1263)).toBe("1,263");
    expect(formatXpExact(1300)).toBe("1,300");
  });
});
