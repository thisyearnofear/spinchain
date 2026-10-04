"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { useRiderProfile, toProfilePayload } from "@/app/stores/rider-profile-store";
import { useProfileSync, persistProfileToWalrus, retrieveProfileFromWalrus } from "@/app/lib/walrus/profile-persistence";
import { isPersonalDataPublicationAllowed } from "@/app/lib/privacy/publication-policy";
import { isSupabaseConfigured } from "@/app/lib/supabase/client";
import { useWalletAuth } from "@/app/hooks/common/use-wallet-auth";

/**
 * useProfileSyncEffect — Auto-syncs rider profile to Walrus + Supabase when wallet connects.
 *
 * On first wallet connection with a complete profile, pushes to Walrus + Supabase.
 * On subsequent connections, checks if a remote profile exists and loads it
 * if the local profile is empty (cross-device portability).
 */
export function useProfileSyncEffect() {
  const { address } = useAccount();
  const { session } = useWalletAuth();
  const profile = useRiderProfile();
  const { syncStatus, setSyncing, setSynced, setFailed, walrusBlobId } = useProfileSync();
  const lastSyncedAddress = useRef<string | null>(null);
  const lastSupabaseSync = useRef<string | null>(null);
  const supabaseGeneration = useRef(0);
  const ownedProfileFor = useRef<string | null>(null);
  const prevCompleteRef = useRef(profile.isComplete());

  // Supabase effects gate on a verified session bound to the connected wallet.
  const authedAddress =
    address && session && session.address === address.toLowerCase()
      ? address
      : null;

  // Supabase: hydrate from server if local profile is empty
  useEffect(() => {
    const generation = ++supabaseGeneration.current;
    const controller = new AbortController();
    const stale = () => generation !== supabaseGeneration.current || controller.signal.aborted;

    if (!authedAddress) {
      lastSupabaseSync.current = null;
      return () => controller.abort();
    }
    if (profile.isComplete()) return () => controller.abort();
    if (!isSupabaseConfigured()) return () => controller.abort();
    if (lastSupabaseSync.current === authedAddress) return () => controller.abort();
    const owner = authedAddress;

    (async () => {
      try {
        const res = await fetch("/api/profile", {
          credentials: "include",
          signal: controller.signal,
        });
        if (stale() || !res.ok) return;
        const { profile: remote } = await res.json();
        if (stale()) return;
        lastSupabaseSync.current = owner;
        if (remote && remote.goal) {
          ownedProfileFor.current = owner;
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

    return () => controller.abort();
  }, [authedAddress, profile]);

  // Supabase: mirror profile to server when it changes and is complete
  useEffect(() => {
    const complete = profile.isComplete();
    if (authedAddress && complete && !prevCompleteRef.current) {
      ownedProfileFor.current = authedAddress;
    }
    prevCompleteRef.current = complete;
    if (!authedAddress) return;
    if (!complete) return;
    if (ownedProfileFor.current !== authedAddress) return;
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
  }, [authedAddress, profile.goal, profile.experience, profile.frequency, profile.motivation, profile.coachPersonality, profile.displayName, profile.ftp, profile.maxHr, profile.restingHr, profile.weightKg, profile.heightCm, profile.injuries, profile.trainingZones]);

  // Walrus sync (existing)
  useEffect(() => {
    // Public personal-data publishing is disabled: stay local/idle,
    // never flip to syncing/failed or retry.
    if (!isPersonalDataPublicationAllowed()) return;
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
