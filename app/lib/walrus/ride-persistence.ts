import { getWalrusClient } from "./client";
import type { RideSummary } from "../analytics/ride-history";

const INDEX_KEY = "spinchain:walrus:ride-blobs:v1";

interface RideBlobIndex {
  [rideId: string]: { blobId: string; className: string; completedAt: number };
}

function readLocalIndex(): RideBlobIndex {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(INDEX_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeLocalIndex(index: RideBlobIndex): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

/**
 * Persist a ride summary to Walrus and register the blobId server-side.
 * Returns the blobId on success, null on failure.
 */
export async function persistRideSummaryToWalrus(
  summary: RideSummary,
): Promise<string | null> {
  try {
    const client = getWalrusClient();
    const result = await client.storeJSON(summary, 90);
    if (!result.success || !result.blobId) return null;

    // Update local cache
    const index = readLocalIndex();
    index[summary.id] = {
      blobId: result.blobId,
      className: summary.className,
      completedAt: summary.completedAt,
    };
    writeLocalIndex(index);

    // Register blobId on server for cross-device access
    try {
      await fetch("/api/rides/walrus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId: summary.id,
          riderId: summary.riderId,
          blobId: result.blobId,
          className: summary.className,
          completedAt: summary.completedAt,
        }),
      });
    } catch {
      // Best-effort server registration; local cache still works
    }

    return result.blobId;
  } catch {
    return null;
  }
}

/**
 * Retrieve a ride summary from Walrus by rideId.
 * Checks local cache first, then server index.
 */
export async function retrieveRideSummaryFromWalrus(
  rideId: string,
): Promise<RideSummary | null> {
  // Try local index first
  let blobId = readLocalIndex()[rideId]?.blobId ?? null;

  // Fall back to server index
  if (!blobId) {
    try {
      const res = await fetch(`/api/rides/walrus?rideId=${encodeURIComponent(rideId)}`);
      if (res.ok) {
        const data = await res.json();
        blobId = data.blobId ?? null;
      }
    } catch {
      // Server unavailable
    }
  }

  if (!blobId) return null;

  try {
    const client = getWalrusClient();
    const result = await client.retrieveJSON<RideSummary>(blobId);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function getWalrusBlobId(rideId: string): string | null {
  return readLocalIndex()[rideId]?.blobId ?? null;
}

export interface WalrusFeedEntry {
  rideId: string;
  blobId: string;
  className: string;
  completedAt: number;
}

/**
 * Get the Walrus feed — rides persisted to decentralized storage.
 * Merges local index with server index for completeness.
 */
export async function getWalrusFeed(riderId?: string): Promise<WalrusFeedEntry[]> {
  // Start with local
  const localIndex = readLocalIndex();
  const localEntries: WalrusFeedEntry[] = Object.entries(localIndex).map(
    ([rideId, entry]) => ({ rideId, ...entry }),
  );

  // Merge server entries
  try {
    const params = new URLSearchParams();
    if (riderId) params.set("riderId", riderId);
    const res = await fetch(`/api/rides/walrus?${params}`);
    if (res.ok) {
      const data = await res.json();
      const serverEntries = (data.entries ?? []) as WalrusFeedEntry[];
      // Merge: server entries not in local
      const localIds = new Set(localEntries.map((e) => e.rideId));
      for (const entry of serverEntries) {
        if (!localIds.has(entry.rideId)) {
          localEntries.push(entry);
        }
      }
    }
  } catch {
    // Use local-only
  }

  return localEntries.sort((a, b) => b.completedAt - a.completedAt);
}
