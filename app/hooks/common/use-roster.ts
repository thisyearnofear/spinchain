"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { isSupabaseConfigured } from "@/app/lib/supabase/client";

export interface RosterEntry {
  address: string;
  ride_count: number;
  last_ride_at: string;
  avg_effort: number;
  avg_power: number;
  avg_heart_rate: number;
  classes_attended: string[];
}

export interface ProgressDelta {
  first_ride_at: string | null;
  last_ride_at: string | null;
  before: { avg_power: number; avg_heart_rate: number; avg_effort: number } | null;
  after: { avg_power: number; avg_heart_rate: number; avg_effort: number } | null;
  deltas: { power: number; effort: number; heart_rate: number } | null;
  total_rides: number;
}

/**
 * useInstructorRoster — fetches the rider roster for the connected instructor.
 */
export function useInstructorRoster() {
  const { address } = useAccount();
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!address || !isSupabaseConfigured()) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/instructor/roster", {
        credentials: "include",
      });
      if (!res.ok) return;
      const { roster: data } = await res.json();
      setRoster(data as RosterEntry[]);
    } catch {
      // Silent fail
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { roster, isLoading, refetch };
}

/**
 * useProgressDelta — fetches progress delta for a rider (optionally filtered by instructor).
 */
export function useProgressDelta(riderAddress: string | null, instructorAddress?: string | null) {
  const [delta, setDelta] = useState<ProgressDelta | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!riderAddress || !isSupabaseConfigured()) return;
    setIsLoading(true);

    const params = new URLSearchParams({ rider: riderAddress });
    if (instructorAddress) params.set("instructor", instructorAddress);

    (async () => {
      try {
        const res = await fetch(`/api/progress/delta?${params}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        setDelta(data as ProgressDelta);
      } catch {
        // Silent fail
      } finally {
        setIsLoading(false);
      }
    })();
  }, [riderAddress, instructorAddress]);

  return { delta, isLoading };
}
