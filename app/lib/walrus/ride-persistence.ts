import { getWalrusClient } from "./client";
import type { RideSummary } from "../analytics/ride-history";

const INDEX_KEY = "spinchain:walrus:ride-blobs:v1";

interface RideBlobIndex {
  [rideId: string]: string;
}

function readIndex(): RideBlobIndex {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(INDEX_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeIndex(index: RideBlobIndex): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export async function persistRideSummaryToWalrus(
  summary: RideSummary,
): Promise<string | null> {
  try {
    const client = getWalrusClient();
    const result = await client.storeJSON(summary, 90);
    if (!result.success || !result.blobId) return null;

    const index = readIndex();
    index[summary.id] = result.blobId;
    writeIndex(index);

    return result.blobId;
  } catch {
    return null;
  }
}

export async function retrieveRideSummaryFromWalrus(
  rideId: string,
): Promise<RideSummary | null> {
  const blobId = readIndex()[rideId];
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
  return readIndex()[rideId] ?? null;
}
