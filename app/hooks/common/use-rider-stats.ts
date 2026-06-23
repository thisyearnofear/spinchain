"use client";

import { useMemo } from "react";
import { getRideHistory, getStreakStats, getPRs, type RideSummary } from "@/app/lib/analytics/ride-history";

export interface RiderStats {
  rides: RideSummary[];
  totalRides: number;
  streak: { daily: number; weekly: number; activeToday: boolean };
  prs: { bestEffort: number; bestPower: number; bestDuration: number; bestSpin: number };
  isFirstTime: boolean;
  hasRides: boolean;
}

const cache: { stats: RiderStats | null; key: number } = {
  stats: null,
  key: 0,
};

function computeStats(): RiderStats {
  const rides = getRideHistory();
  const streak = getStreakStats(rides);
  const prs = getPRs(rides);
  return {
    rides,
    totalRides: rides.length,
    streak,
    prs,
    isFirstTime: rides.length === 0,
    hasRides: rides.length > 0,
  };
}

function getOrCreateStats(currentKey: number): RiderStats {
  if (cache.stats && cache.key === currentKey) {
    return cache.stats;
  }
  cache.stats = computeStats();
  cache.key = currentKey;
  return cache.stats;
}

export function useRiderStats(): RiderStats {
  return useMemo(() => {
    const currentKey = typeof window !== "undefined"
      ? Number(localStorage.getItem("spinchain-ride-history-version") || "0") + getRideHistory().length
      : 0;
    return getOrCreateStats(currentKey);
  }, []);
}

export function invalidateRiderStatsCache() {
  cache.stats = null;
  cache.key = 0;
}
