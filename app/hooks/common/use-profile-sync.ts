"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { useRiderProfile, toProfilePayload } from "@/app/stores/rider-profile-store";
import { useProfileSync, persistProfileToWalrus, retrieveProfileFromWalrus } from "@/app/lib/walrus/profile-persistence";
import { isSupabaseConfigured } from "@/app/lib/supabase/client";

/**
 * useProfileSyncEffect — Auto-syncs rider profile to Walrus + Supabase when wallet connects.
 *
 * On first wallet connection with a complete profile, pushes to Walrus + Supabase.
 * On subsequent connections, checks if a remote profile exists and loads it
 * if the local profile is empty (cross-device portability).
 */
export function useProfileSyncEffect() {
  const { address } = useAccount();
  const profile = useRiderProfile();
  const { syncStatus, setSyncing, setSynced, setFailed, walrusBlobId } = useProfileSync();
  const lastSyncedAddress = useRef<string | null>(null);
  const lastSupabaseSync = useRef<string | null>(null);

  // Supabase: hydrate from server if local profile is empty
  useEffect(() => {
    if (!address) return;
    if (profile.isComplete()) return;
    if (!isSupabaseConfigured()) return;
    if (lastSupabaseSync.current === address) return;
    lastSupabaseSync.current = address;

    (async () => {
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        if (!res.ok) return;
        const { profile: remote } = await res.json();
        if (remote && remote.goal) {
          profile.setProfile({
            goal: remote.goal,
            experience: remote.experience,
            frequency: remote.frequency,
            motivation: remote.motivation,
            coachPersonality: remote.coach_personality,
            displayName: remote.display_name,
            ftp: remote.ftp,
            maxHr: remote.max_hr,
            restingHr: remote.resting_hr,
            weightKg: remote.weight_kg,
            heightCm: remote.height_cm,
            injuries: remote.injuries,
            trainingZones: remote.training_zones,
          });
        }
      } catch {
        // Silent fail — localStorage is the fallback
      }
    })();
  }, [address, profile]);

  // Supabase: mirror profile to server when it changes and is complete
  useEffect(() => {
    if (!address) return;
    if (!profile.isComplete()) return;
    if (!isSupabaseConfigured()) return;

    const timer = setTimeout(() => {
      void fetch("/api/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: profile.goal,
          experience: profile.experience,
          frequency: profile.frequency,
          motivation: profile.motivation,
          coach_personality: profile.coachPersonality,
          display_name: profile.displayName,
          ftp: profile.ftp,
          max_hr: profile.maxHr,
          resting_hr: profile.restingHr,
          weight_kg: profile.weightKg,
          height_cm: profile.heightCm,
          injuries: profile.injuries,
          training_zones: profile.trainingZones,
        }),
      }).catch(() => {});
    }, 1000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, profile.goal, profile.experience, profile.frequency, profile.motivation, profile.coachPersonality, profile.displayName, profile.ftp, profile.maxHr, profile.restingHr, profile.weightKg, profile.heightCm, profile.injuries, profile.trainingZones]);

  // Walrus sync (existing)
  useEffect(() => {
    if (!address || !profile.isComplete()) return;
    if (lastSyncedAddress.current === address) return;
    if (syncStatus === "synced" && walrusBlobId) {
      lastSyncedAddress.current = address;
      return;
    }

    let cancelled = false;
    (async () => {
      setSyncing();
      const blobId = await persistProfileToWalrus(toProfilePayload(profile), address);
      if (cancelled) return;
      if (blobId) {
        setSynced(blobId);
        lastSyncedAddress.current = address;
      } else {
        setFailed();
      }
    })();

    return () => { cancelled = true; };
  }, [address, profile, syncStatus, walrusBlobId, setSyncing, setSynced, setFailed]);

  // Cross-device: load remote profile from Walrus if local is empty
  useEffect(() => {
    if (!address) return;
    if (profile.isComplete()) return;

    let cancelled = false;
    (async () => {
      const remote = await retrieveProfileFromWalrus(address);
      if (cancelled || !remote) return;
      profile.setProfile(remote.profile);
    })();

    return () => { cancelled = true; };
  }, [address, profile]);
}
