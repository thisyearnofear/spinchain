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

let cachedStats: RiderStats | null = null;
let cacheKey = 0;

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

export function useRiderStats(): RiderStats {
  return useMemo(() => {
    const currentKey = typeof window !== "undefined"
      ? Number(localStorage.getItem("spinchain-ride-history-version") || "0") + getRideHistory().length
      : 0;

    if (cachedStats && cacheKey === currentKey) {
      return cachedStats;
    }

    cachedStats = computeStats();
    cacheKey = currentKey;
    return cachedStats;
  }, []);
}

export function invalidateRiderStatsCache() {
  cachedStats = null;
  cacheKey = 0;
}
