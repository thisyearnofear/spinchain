"use client";

/**
 * Device-local record of completed testnet redemptions, keyed by ride id.
 * Deliberately separate from RideReceiptV1 — the receipt stays immutable and
 * forbidden-upgrade-fields clean; settlement evidence lives here.
 */

export interface RedemptionRecord {
  rideId: string;
  nullifier: `0x${string}`;
  txHash: `0x${string}`;
  confirmedAt: number;
}

const REDEMPTIONS_KEY = "spinchain:redemptions:v1";

function isClient() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readAll(): Record<string, RedemptionRecord> {
  if (!isClient()) return {};
  try {
    const raw = localStorage.getItem(REDEMPTIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, RedemptionRecord> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (
        v &&
        typeof v === "object" &&
        typeof (v as RedemptionRecord).txHash === "string" &&
        typeof (v as RedemptionRecord).nullifier === "string"
      ) {
        out[k] = v as RedemptionRecord;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function getRedemption(rideId: string): RedemptionRecord | null {
  return readAll()[rideId] ?? null;
}

export function saveRedemption(record: RedemptionRecord): void {
  if (!isClient()) return;
  const all = readAll();
  all[record.rideId] = record;
  try {
    localStorage.setItem(REDEMPTIONS_KEY, JSON.stringify(all));
  } catch {
    // storage full/blocked — non-fatal; the on-chain record is authoritative
  }
}
