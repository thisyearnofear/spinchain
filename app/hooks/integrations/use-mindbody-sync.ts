"use client";

import { useState, useCallback } from "react";

interface MindbodySyncResponse {
  success: boolean;
  synced: number;
  skipped: number;
  errors: string[];
  error?: string;
  claimLinks: Array<{
    url: string;
    expiresAt: number;
    bookingId: number;
    clientEmail: string;
    className: string;
  }>;
}

interface MindbodyClassesResponse {
  success: boolean;
  error?: string;
  classes: Array<{
    id: number;
    name: string;
    description: string;
    instructor: string;
    location: string;
    startDateTime: string;
    endDateTime: string;
    maxCapacity: number;
    totalBooked: number;
  }>;
}

export function useMindbodySync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<MindbodySyncResponse | null>(null);
  const [classes, setClasses] = useState<MindbodyClassesResponse["classes"]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncBookings = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/mindbody/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data: MindbodySyncResponse = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Sync failed");
      }
      setSyncResult(data);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      setError(msg);
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const fetchUpcomingClasses = useCallback(async (days = 7) => {
    setIsLoadingClasses(true);
    setError(null);
    try {
      const res = await fetch(`/api/integrations/mindbody/sync?days=${days}`);
      const data: MindbodyClassesResponse = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Fetch failed");
      }
      setClasses(data.classes);
      return data.classes;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fetch failed";
      setError(msg);
      return [];
    } finally {
      setIsLoadingClasses(false);
    }
  }, []);

  return {
    syncBookings,
    fetchUpcomingClasses,
    isSyncing,
    isLoadingClasses,
    syncResult,
    classes,
    error,
  };
}
