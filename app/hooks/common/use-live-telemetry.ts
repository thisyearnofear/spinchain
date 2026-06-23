"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface LiveTelemetryPayload {
  classId: string;
  activeRiders: number;
  avgPower: number;
  avgHeartRate: number;
  avgEffort: number;
  avgCadence: number;
  riders: Array<{
    address: string;
    heartRate: number;
    power: number;
    cadence: number;
    effort: number;
    elapsedSec: number;
    updatedAt: string;
  }>;
}

/**
 * Instructor hook: polls aggregated live telemetry for a class.
 * Refreshes every `intervalMs` (default 5s).
 */
export function useLiveTelemetry(classId: string | null, intervalMs = 5000) {
  const [data, setData] = useState<LiveTelemetryPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/live-telemetry?classId=${encodeURIComponent(classId)}`,
          { credentials: "include" },
        );
        if (res.ok && !cancelled) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // silent — will retry next interval
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [classId, intervalMs]);

  return { data, loading };
}

/**
 * Rider hook: pushes telemetry to the server at a throttled interval.
 * Call `pushTelemetry` with the latest snapshot — it will auto-throttle to
 * every `throttleMs` (default 3s) to avoid hammering the API.
 */
export function usePushLiveTelemetry(classId: string | null, throttleMs = 3000) {
  const lastPushRef = useRef(0);
  const classIdRef = useRef(classId);
  useEffect(() => {
    classIdRef.current = classId;
  }, [classId]);

  const pushTelemetry = useCallback(async (metrics: {
    heartRate: number;
    power: number;
    cadence: number;
    effort: number;
    elapsedSec: number;
  }) => {
    const cid = classIdRef.current;
    if (!cid) return;

    const now = Date.now();
    if (now - lastPushRef.current < throttleMs) return;
    lastPushRef.current = now;

    try {
      await fetch("/api/live-telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ classId: cid, ...metrics }),
      });
    } catch {
      // non-blocking
    }
  }, [throttleMs]);

  const clearTelemetry = useCallback(async () => {
    const cid = classIdRef.current;
    if (!cid) return;
    try {
      await fetch(
        `/api/live-telemetry?classId=${encodeURIComponent(cid)}`,
        { method: "DELETE", credentials: "include" },
      );
    } catch {
      // non-blocking
    }
  }, []);

  return { pushTelemetry, clearTelemetry };
}
