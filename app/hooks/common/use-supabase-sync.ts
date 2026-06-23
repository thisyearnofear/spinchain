"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { isSupabaseConfigured } from "@/app/lib/supabase/client";
import type { RideSummary } from "@/app/lib/analytics/ride-history";

/**
 * saveRideToSupabase — standalone fire-and-forget save to Supabase.
 * Called from use-ride-persistence after localStorage save.
 * No-op if Supabase is not configured.
 */
export async function saveRideToSupabase(ride: RideSummary): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    await fetch("/api/rides", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: ride.id,
        idempotency_key: ride.idempotencyKey,
        class_id: ride.classId,
        class_name: ride.className,
        instructor: ride.instructor,
        completed_at: new Date(ride.completedAt).toISOString(),
        elapsed_time: ride.durationSec,
        avg_effort: ride.avgEffort,
        avg_heart_rate: ride.avgHeartRate,
        avg_power: ride.avgPower,
        effort_tier: ride.effortTier,
        zones: ride.zones,
      }),
    });
  } catch {
    // Silent fail — localStorage is the source of truth
  }
}

/**
 * useSupabaseSync — hydrates localStorage from Supabase on mount.
 *
 * The Zustand store and getRideHistory() remain synchronous — they read
 * from localStorage. This hook ensures localStorage is hydrated from
 * Supabase on mount when a wallet is connected.
 *
 * Writes to Supabase are handled by saveRideToSupabase() (standalone),
 * called from use-ride-persistence after localStorage save.
 */
export function useSupabaseSync() {
  const { address } = useAccount();
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (hasHydrated.current) return;
    if (!address) return;
    if (!isSupabaseConfigured()) return;

    hasHydrated.current = true;

    (async () => {
      try {
        const res = await fetch("/api/rides?limit=200", {
          credentials: "include",
        });
        if (!res.ok) return;
        const { rides } = await res.json();
        if (!rides || rides.length === 0) return;

        const { STORAGE_KEYS } = await import("@/app/lib/analytics/ride-history");
        const existing = localStorage.getItem(STORAGE_KEYS.rideHistory);
        const existingRides: RideSummary[] = existing ? JSON.parse(existing) : [];
        const existingIds = new Set(existingRides.map((r) => r.idempotencyKey));

        const newRides = rides
          .filter((r: { idempotency_key: string }) => !existingIds.has(r.idempotency_key))
          .map(mapSupabaseRowToRideSummary)
          .filter((r: RideSummary | null): r is RideSummary => r !== null);

        if (newRides.length > 0) {
          const merged = [...newRides, ...existingRides].slice(0, 200);
          localStorage.setItem(STORAGE_KEYS.rideHistory, JSON.stringify(merged));
          const currentVersion = Number(localStorage.getItem("spinchain-ride-history-version") || "0");
          localStorage.setItem("spinchain-ride-history-version", String(currentVersion + 1));
        }
      } catch {
        // Silent fail — localStorage is the fallback
      }
    })();
  }, [address]);
}

function mapSupabaseRowToRideSummary(row: Record<string, unknown>): RideSummary | null {
  if (!row || typeof row.id !== "string") return null;

  return {
    schemaVersion: "1.0",
    id: row.id as string,
    idempotencyKey: (row.idempotency_key as string) || row.id as string,
    riderId: (row.rider_address as string) || "guest",
    classId: (row.class_id as string) || "",
    className: (row.class_name as string) || "",
    instructor: (row.instructor as string) || "",
    completedAt: row.completed_at
      ? new Date(row.completed_at as string).getTime()
      : Date.now(),
    durationSec: (row.elapsed_time as number) || 0,
    avgHeartRate: (row.avg_heart_rate as number) || 0,
    avgPower: (row.avg_power as number) || 0,
    avgEffort: (row.avg_effort as number) || 0,
    spinEarned: 0,
    telemetrySource: "simulator",
    effortTier: (row.effort_tier as RideSummary["effortTier"]) || "bronze",
    zones: (row.zones as RideSummary["zones"]) || {
      recovery: 25,
      endurance: 35,
      threshold: 25,
      sprint: 15,
    },
    proof: { mode: "none", isVerified: false, privacyScore: 0, privacyLevel: "high" },
    sync: { status: "anchored", retryCount: 0 },
  };
}
