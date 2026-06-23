"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { isSupabaseConfigured } from "@/app/lib/supabase/client";

export interface HomeworkAssignment {
  id: string;
  instructor_address: string;
  rider_address: string;
  class_id: string | null;
  due_at: string | null;
  workout_config: Record<string, unknown> | null;
  status: "assigned" | "in_progress" | "completed" | "expired";
  assigned_at: string;
  completed_at: string | null;
  ride_id: string | null;
}

/**
 * useRiderHomework — fetches homework for the connected rider.
 * Polls on mount, returns loading state and refetch function.
 */
export function useRiderHomework() {
  const { address } = useAccount();
  const [homework, setHomework] = useState<HomeworkAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!address || !isSupabaseConfigured()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/homework?rider=${address}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const { homework: data } = await res.json();
      setHomework(data as HomeworkAssignment[]);
    } catch {
      // Silent fail
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { homework, isLoading, refetch };
}

/**
 * useInstructorHomework — fetches all homework assigned by the connected instructor.
 */
export function useInstructorHomework() {
  const { address } = useAccount();
  const [homework, setHomework] = useState<HomeworkAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!address || !isSupabaseConfigured()) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/homework", {
        credentials: "include",
      });
      if (!res.ok) return;
      const { homework: data } = await res.json();
      setHomework(data as HomeworkAssignment[]);
    } catch {
      // Silent fail
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const assignHomework = useCallback(async (
    riderAddress: string,
    classId: string | null,
    workoutConfig: Record<string, unknown> | null,
    dueAt: string | null,
  ): Promise<HomeworkAssignment | null> => {
    if (!address || !isSupabaseConfigured()) return null;
    try {
      const res = await fetch("/api/homework", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rider_address: riderAddress,
          class_id: classId,
          workout_config: workoutConfig,
          due_at: dueAt,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      void refetch();
      return data as HomeworkAssignment;
    } catch {
      return null;
    }
  }, [address, refetch]);

  const updateHomework = useCallback(async (
    id: string,
    updates: Partial<Pick<HomeworkAssignment, "status" | "completed_at" | "ride_id">>,
  ): Promise<boolean> => {
    if (!isSupabaseConfigured()) return false;
    try {
      const res = await fetch(`/api/homework?id=${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) return false;
      void refetch();
      return true;
    } catch {
      return false;
    }
  }, [refetch]);

  return { homework, isLoading, refetch, assignHomework, updateHomework };
}
