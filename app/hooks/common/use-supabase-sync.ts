"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { isSupabaseConfigured } from "@/app/lib/supabase/client";
import { useWalletAuth } from "@/app/hooks/common/use-wallet-auth";
import { EVM_ADDRESS_RE, SUI_ADDRESS_RE } from "@/app/lib/auth/types";
import type { RideSummary } from "@/app/lib/analytics/ride-history";
import { normalizeSummaryForRead } from "@/app/lib/analytics/ride-summary-normalize";
import { hasConsent, useConsent } from "@/app/lib/privacy/consent";

/** Dispatched on window after cloud hydration mutates local history. */
export const RIDE_HISTORY_UPDATED_EVENT = "spinchain:ride-history-updated";

/**
 * saveRideToSupabase — standalone save to Supabase.
 * Called from use-ride-persistence after localStorage save.
 * Returns false when Supabase is not configured, the rider id is not a valid
 * owned address, or the live session does not match ride.riderId.
 */
export async function saveRideToSupabase(ride: RideSummary): Promise<boolean> {
  if (!hasConsent("cloud_history")) return false;
  if (!isSupabaseConfigured()) return false;
  const riderId = ride.riderId?.toLowerCase();
  if (!riderId || (!EVM_ADDRESS_RE.test(riderId) && !SUI_ADDRESS_RE.test(riderId))) {
    return false;
  }

  try {
    const me = await fetch("/api/auth/me", { credentials: "include" });
    if (!me.ok) return false;
    const { session } = (await me.json()) as {
      session: { address?: string } | null;
    };
    if (session?.address !== riderId) return false;

    const response = await fetch("/api/rides", {
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
        summary: ride,
      }),
    });
    return response.ok;
  } catch {
    // Silent fail — localStorage is the source of truth
    return false;
  }
}

/** Retry cloud save for all local rides owned by this wallet. */
async function syncOwnedLocalRides(
  ownerAddress: string,
  isStale: () => boolean,
): Promise<void> {
  try {
    const { STORAGE_KEYS } = await import("@/app/lib/analytics/ride-history");
    const raw = localStorage.getItem(STORAGE_KEYS.rideHistory);
    const rides: RideSummary[] = raw ? JSON.parse(raw) : [];
    const pending = rides.filter(
      (ride) => ride.riderId === ownerAddress.toLowerCase(),
    );
    for (const ride of pending) {
      if (isStale()) return;
      await saveRideToSupabase(ride);
    }
  } catch {
    // Best-effort backfill; local storage remains source of truth.
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
 *
 * Hydration and writes require a verified session matching the connected
 * wallet and the rider's cloud_history consent; a bare wallet connection is
 * not enough.
 */
export function useSupabaseSync() {
  const { address } = useAccount();
  const { session } = useWalletAuth();
  const [cloudConsent] = useConsent("cloud_history");
  const hydratedForRef = useRef<string | null>(null);
  const generationRef = useRef(0);

  const readyAddress =
    address &&
    session &&
    session.address === address.toLowerCase() &&
    cloudConsent &&
    isSupabaseConfigured()
      ? address.toLowerCase()
      : null;

  useEffect(() => {
    const generation = ++generationRef.current;
    const controller = new AbortController();
    const stale = () => generation !== generationRef.current || controller.signal.aborted;

    if (!readyAddress) {
      hydratedForRef.current = null;
      return () => controller.abort();
    }
    if (hydratedForRef.current === readyAddress) {
      return () => controller.abort();
    }
    const owner = readyAddress;

    (async () => {
      try {
        const res = await fetch("/api/rides?limit=200", {
          credentials: "include",
          signal: controller.signal,
        });
        if (stale()) return;
        if (res.ok) {
          const { rides } = await res.json();
          if (stale()) return;
          hydratedForRef.current = owner;
          if (rides && rides.length > 0) {
            const { STORAGE_KEYS } = await import("@/app/lib/analytics/ride-history");
            if (stale()) return;
            const existing = localStorage.getItem(STORAGE_KEYS.rideHistory);
            const existingRides: RideSummary[] = existing ? JSON.parse(existing) : [];
            const existingIds = new Set(existingRides.map((r) => r.idempotencyKey));

            const newRides = rides
              .filter(
                (r: { idempotency_key?: string }) =>
                  !existingIds.has(r.idempotency_key ?? ""),
              )
              .map((row: Record<string, unknown>) =>
                mapSupabaseRowToRideSummary(row, owner),
              )
              .filter((r: RideSummary | null): r is RideSummary => r !== null);

            if (newRides.length > 0 && !stale()) {
              const merged = [...newRides, ...existingRides].slice(0, 200);
              localStorage.setItem(STORAGE_KEYS.rideHistory, JSON.stringify(merged));
              const currentVersion = Number(
                localStorage.getItem("spinchain-ride-history-version") || "0",
              );
              localStorage.setItem(
                "spinchain-ride-history-version",
                String(currentVersion + 1),
              );
              window.dispatchEvent(new Event(RIDE_HISTORY_UPDATED_EVENT));
            }
          }
        }
      } catch {
        // Silent fail — localStorage is the fallback
      }

      if (stale()) return;
      await syncOwnedLocalRides(owner, stale);
    })();

    return () => controller.abort();
  }, [readyAddress]);
}

/**
 * Map a ride_summaries row to a RideSummary. A canonical `summary` whose
 * identity matches the row supplies reward/proof metadata; legacy rows map
 * to a plain ride (estimated telemetry, local_only sync — cloud presence is
 * not Sui anchoring).
 */
function mapSupabaseRowToRideSummary(
  row: Record<string, unknown>,
  ownerAddress: string,
): RideSummary | null {
  if (!row || typeof row.id !== "string") return null;

  const id = row.id as string;
  const idempotencyKey = (row.idempotency_key as string) || id;

  const normalized = normalizeSummaryForRead(row.summary);
  const s =
    normalized &&
    normalized.id === id &&
    normalized.idempotencyKey === idempotencyKey &&
    normalized.riderId === ownerAddress
      ? normalized
      : null;

  return {
    schemaVersion: "1.0",
    id,
    idempotencyKey,
    riderId: ownerAddress,
    classId:
      (typeof s?.classId === "string" ? s.classId : (row.class_id as string)) ||
      "",
    className:
      (typeof s?.className === "string" ? s.className : (row.class_name as string)) ||
      "",
    instructor:
      (typeof s?.instructor === "string" ? s.instructor : (row.instructor as string)) ||
      "",
    completedAt:
      (typeof s?.completedAt === "number" ? s.completedAt : undefined) ??
      (row.completed_at
        ? new Date(row.completed_at as string).getTime()
        : Date.now()),
    durationSec:
      (typeof s?.durationSec === "number" ? s.durationSec : undefined) ??
      ((row.elapsed_time as number) || 0),
    avgHeartRate:
      (typeof s?.avgHeartRate === "number" ? s.avgHeartRate : undefined) ??
      ((row.avg_heart_rate as number) || 0),
    avgPower:
      (typeof s?.avgPower === "number" ? s.avgPower : undefined) ??
      ((row.avg_power as number) || 0),
    avgEffort:
      (typeof s?.avgEffort === "number" ? s.avgEffort : undefined) ??
      ((row.avg_effort as number) || 0),
    spinEarned: typeof s?.spinEarned === "number" ? s.spinEarned : 0,
    telemetrySource:
      (s?.telemetrySource as RideSummary["telemetrySource"]) || "estimated",
    effortTier:
      (s?.effortTier as RideSummary["effortTier"]) ||
      (row.effort_tier as RideSummary["effortTier"]) ||
      "bronze",
    zones: (s?.zones as RideSummary["zones"]) ?? {
      recovery: 0,
      endurance: 0,
      threshold: 0,
      sprint: 0,
    },
    proof: (s?.proof as RideSummary["proof"]) ?? {
      mode: "none",
      status: "idle",
      isVerified: false,
      privacyScore: 0,
      privacyLevel: "high",
    },
    settlement: s?.settlement as RideSummary["settlement"],
    anchoring: s?.anchoring as RideSummary["anchoring"],
    receipt: s?.receipt as RideSummary["receipt"],
    sync: { status: "local_only", retryCount: 0 },
  };
}
