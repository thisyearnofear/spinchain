"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { RiderProfile } from "@/app/stores/rider-profile-store";
import { STORAGE_KEYS } from "@/app/lib/analytics/ride-history";

export interface ProfileSyncState {
  walrusBlobId: string | null;
  suiTxDigest: string | null;
  lastSyncedAt: number | null;
  syncStatus: "idle" | "syncing" | "synced" | "failed";
}

interface ProfileSyncStore extends ProfileSyncState {
  setSynced: (blobId: string, txDigest?: string) => void;
  setSyncing: () => void;
  setFailed: () => void;
  reset: () => void;
}

export const useProfileSync = create<ProfileSyncStore>()(
  persist(
    (set) => ({
      walrusBlobId: null,
      suiTxDigest: null,
      lastSyncedAt: null,
      syncStatus: "idle",
      setSynced: (blobId, txDigest) =>
        set({ walrusBlobId: blobId, suiTxDigest: txDigest ?? null, lastSyncedAt: Date.now(), syncStatus: "synced" }),
      setSyncing: () => set({ syncStatus: "syncing" }),
      setFailed: () => set({ syncStatus: "failed" }),
      reset: () => set({ walrusBlobId: null, suiTxDigest: null, lastSyncedAt: null, syncStatus: "idle" }),
    }),
    {
      name: STORAGE_KEYS.profileSync,
      storage: createJSONStorage(() => localStorage),
    }
  )
);

const PROFILE_INDEX_KEY = STORAGE_KEYS.walrusProfileBlob;

function readProfileIndex(): { blobId: string; address: string; syncedAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(PROFILE_INDEX_KEY) ?? "null");
  } catch {
    return null;
  }
}

function writeProfileIndex(data: { blobId: string; address: string; syncedAt: number }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROFILE_INDEX_KEY, JSON.stringify(data));
}

/**
 * Persist rider profile to Walrus.
 * Returns blobId on success, null on failure.
 */
export async function persistProfileToWalrus(
  profile: RiderProfile,
  address: string
): Promise<string | null> {
  try {
    const { getWalrusClient } = await import("@/app/lib/walrus/client");
    const client = getWalrusClient();
    const payload = {
      type: "rider-profile",
      version: "1.0",
      address,
      profile,
      syncedAt: Date.now(),
    };
    const result = await client.storeJSON(payload, 365);
    if (!result.success || !result.blobId) return null;

    writeProfileIndex({ blobId: result.blobId, address, syncedAt: Date.now() });
    return result.blobId;
  } catch {
    return null;
  }
}

/**
 * Retrieve rider profile from Walrus by address.
 * Checks local index first, then falls back to null.
 */
export async function retrieveProfileFromWalrus(
  address: string
): Promise<{ profile: RiderProfile; blobId: string } | null> {
  const index = readProfileIndex();
  if (!index || index.address !== address) return null;

  try {
    const { getWalrusClient } = await import("@/app/lib/walrus/client");
    const client = getWalrusClient();
    const result = await client.retrieveJSON<{ profile: RiderProfile; type: string }>(index.blobId);
    if (!result.success || !result.data || result.data.type !== "rider-profile") return null;
    return { profile: result.data.profile, blobId: index.blobId };
  } catch {
    return null;
  }
}

/**
 * Get the Walrus blob ID for the profile, if synced.
 */
export function getProfileBlobId(): string | null {
  return readProfileIndex()?.blobId ?? null;
}
