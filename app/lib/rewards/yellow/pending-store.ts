"use client";

import type { SignedRewardUpdate } from "../types";

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
