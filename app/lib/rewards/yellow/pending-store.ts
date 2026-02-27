"use client";

import type { SignedRewardUpdate } from "../types";
import { getSessions } from "./clearnode";
import type { Address } from "viem";

export type PendingSettlementStatus =
  | "rider_signed"
  | "instructor_signed"
  | "settled";

export interface PendingYellowSettlement {
  id: string; // channelId
  channelId: `0x${string}`;
  classId: `0x${string}`;
  rider: `0x${string}`;
  instructor: `0x${string}`;

  finalReward: bigint;
  effortScore: number;

  // Signatures on the final state (EIP-712 compatible, hex strings)
  riderSignature: `0x${string}`;
  instructorSignature?: `0x${string}`;

  // Update chain (rider-signed updates)
  updates: Array<{
    channelId: `0x${string}`;
    classId: `0x${string}`;
    rider: `0x${string}`;
    instructor: `0x${string}`;
    timestamp: number;
    sequence: number;
    accumulatedReward: string; // store as string for JSON stability
    heartRate: number;
    power: number;
    signature: `0x${string}`;
  }>;

  status: PendingSettlementStatus;
  createdAt: number;
  updatedAt: number;
  txHash?: `0x${string}`;
}

const STORAGE_KEY = "spinchain:yellow:pending:v1";

function safeParse(json: string | null): PendingYellowSettlement[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as PendingYellowSettlement[];
  } catch {
    return [];
  }
}

export function listPendingSettlements(): PendingYellowSettlement[] {
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

/**
 * Sync pending settlements from Yellow ClearNode.
 * Queries closed app sessions and merges with local store.
 */
export async function syncPendingWithSDK(address: Address): Promise<void> {
  try {
    const sessions = await getSessions(address, "closed");
    const localItems = listPendingSettlements();
    let changed = false;

    for (const s of sessions) {
      const idx = localItems.findIndex((x) => x.id === s.appSessionId);
      if (idx >= 0) continue; // Already tracked locally

      const data = JSON.parse(s.sessionData || "{}");
      if (data.type !== "reward-channel") continue;

      localItems.unshift({
        id: s.appSessionId,
        channelId: s.appSessionId as `0x${string}`,
        classId: (data.classId || "0x0") as `0x${string}`,
        rider: s.participants[0] as `0x${string}`,
        instructor: s.participants[1] as `0x${string}`,
        finalReward: BigInt(0),
        effortScore: 0,
        riderSignature: "0x" as `0x${string}`,
        updates: [],
        status: "rider_signed",
        createdAt: s.nonce,
        updatedAt: Date.now(),
      });
      changed = true;
    }

    if (changed) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localItems));
    }
  } catch (err) {
    console.warn("[Yellow] Failed to sync with ClearNode:", err);
  }
}

export function upsertPendingSettlement(item: PendingYellowSettlement): void {
  const items = listPendingSettlements();
  const idx = items.findIndex((x) => x.id === item.id);
  if (idx >= 0) items[idx] = item;
  else items.unshift(item);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function markPendingSettlementSettled(channelId: string, txHash: `0x${string}`): void {
  const items = listPendingSettlements();
  const idx = items.findIndex((x) => x.id === channelId);
  if (idx < 0) return;

  const prev = items[idx];
  items[idx] = {
    ...prev,
    status: "settled",
    txHash,
    updatedAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function removePendingSettlement(channelId: string): void {
  const items = listPendingSettlements().filter((x) => x.id !== channelId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function toStoredUpdates(updates: SignedRewardUpdate[]) {
  return updates.map((u) => ({
    channelId: u.channelId,
    classId: u.classId,
    rider: u.rider,
    instructor: u.instructor,
    timestamp: u.timestamp,
    sequence: u.sequence,
    accumulatedReward: u.accumulatedReward.toString(),
    heartRate: u.heartRate,
    power: u.power,
    signature: u.riderSignature as `0x${string}`,
  }));
}
