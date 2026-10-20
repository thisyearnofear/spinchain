/**
 * Progression Celebration Store — the moment a ride pays out.
 *
 * The progression ledger (`app/lib/progression.ts`) owns the durable record.
 * This store owns the *event*: the XP just granted, the rank transition it
 * caused, and whether a rank-up deserves a full-screen moment.
 *
 * It is deliberately separate from the ledger so the celebration can be
 * dismissed, replayed, or ignored without touching stored progression.
 */

import { create } from "zustand";
import type { ProgressionEntry, RankDefinition } from "@/app/lib/progression";

export interface RankUpEvent {
  entry: ProgressionEntry;
  from: RankDefinition;
  to: RankDefinition;
}

interface ProgressionCelebrationState {
  /** XP granted by the most recent ride, if it has not been consumed. */
  lastEntry: ProgressionEntry | null;
  /** Set when the most recent ride caused a rank-up. */
  lastRankUp: RankUpEvent | null;
  /** True while a rank-up moment is being shown. */
  rankUpOpen: boolean;

  recordAward: (entry: ProgressionEntry, rankUp: RankUpEvent | null) => void;
  openRankUp: () => void;
  dismissRankUp: () => void;
  clearAward: () => void;
}

export const useProgressionCelebration = create<ProgressionCelebrationState>()(
  (set) => ({
    lastEntry: null,
    lastRankUp: null,
    rankUpOpen: false,

    recordAward: (entry, rankUp) =>
      set({ lastEntry: entry, lastRankUp: rankUp, rankUpOpen: !!rankUp }),

    openRankUp: () => set({ rankUpOpen: true }),

    dismissRankUp: () => set({ rankUpOpen: false }),

    clearAward: () => set({ lastEntry: null, lastRankUp: null }),
  }),
);
