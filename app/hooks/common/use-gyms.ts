"use client";

import { useState, useEffect, useCallback } from "react";
import { isSupabaseConfigured } from "@/app/lib/supabase/client";
import type { CalibrationProfile } from "@/app/lib/telemetry/normalization";

export interface Gym {
  id: string;
  name: string;
  location: string | null;
  brand: string;
  power_offset: number;
  power_scale: number;
  hr_offset: number;
  hr_scale: number;
  created_by: string | null;
}

export interface BikeCalibration {
  id: string;
  gym_id: string;
  bike_id: string;
  power_offset: number;
  power_scale: number;
  hr_offset: number;
  hr_scale: number;
  calibrated_at: string;
}

export interface GymWithBikes extends Gym {
  bikes: BikeCalibration[];
}

/**
 * useGyms — fetches the list of registered gyms
 */
export function useGyms() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/gyms", { credentials: "include" });
      if (!res.ok) return;
      const { gyms: data } = await res.json();
      setGyms(data as Gym[]);
    } catch {
      // Silent fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { gyms, isLoading, refetch };
}

/**
 * useGymDetail — fetches a single gym with its bike calibrations
 */
export function useGymDetail(gymId: string | null) {
  const [gym, setGym] = useState<GymWithBikes | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!gymId || !isSupabaseConfigured()) return;
    setIsLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/gyms?id=${gymId}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setGym(data as GymWithBikes);
      } catch {
        // Silent fail
      } finally {
        setIsLoading(false);
      }
    })();
  }, [gymId]);

  return { gym, isLoading };
}

/**
 * useCreateGym — creates a new gym
 */
export function useCreateGym() {
  const [isCreating, setIsCreating] = useState(false);

  const create = useCallback(async (params: {
    name: string;
    location?: string;
    brand?: string;
    power_offset?: number;
    power_scale?: number;
    hr_offset?: number;
    hr_scale?: number;
  }): Promise<Gym | null> => {
    if (!isSupabaseConfigured()) return null;
    setIsCreating(true);
    try {
      const res = await fetch("/api/gyms", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) return null;
      return await res.json() as Gym;
    } catch {
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  return { create, isCreating };
}

/**
 * useCalibrateBike — adds or updates a bike calibration within a gym
 */
export function useCalibrateBike() {
  const [isSaving, setIsSaving] = useState(false);

  const calibrate = useCallback(async (
    gymId: string,
    bikeId: string,
    cal: Partial<CalibrationProfile>,
  ): Promise<boolean> => {
    if (!isSupabaseConfigured()) return false;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/gyms?gymId=${gymId}&bike=${bikeId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cal),
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return { calibrate, isSaving };
}
