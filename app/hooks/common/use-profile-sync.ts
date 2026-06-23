"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { useRiderProfile } from "@/app/stores/rider-profile-store";
import { useProfileSync, persistProfileToWalrus, retrieveProfileFromWalrus } from "@/app/lib/walrus/profile-persistence";

/**
 * useProfileSyncEffect — Auto-syncs rider profile to Walrus when wallet connects.
 *
 * On first wallet connection with a complete profile, pushes to Walrus.
 * On subsequent connections, checks if a remote profile exists and loads it
 * if the local profile is empty (cross-device portability).
 */
export function useProfileSyncEffect() {
  const { address } = useAccount();
  const profile = useRiderProfile();
  const { syncStatus, setSyncing, setSynced, setFailed, walrusBlobId } = useProfileSync();
  const lastSyncedAddress = useRef<string | null>(null);

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
      const blobId = await persistProfileToWalrus(
        {
          goal: profile.goal,
          experience: profile.experience,
          frequency: profile.frequency,
          motivation: profile.motivation,
          coachPersonality: profile.coachPersonality,
          displayName: profile.displayName,
          createdAt: profile.createdAt,
        },
        address
      );
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

  // Cross-device: load remote profile if local is empty
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
