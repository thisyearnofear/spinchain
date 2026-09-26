/**
 * Coach Memory — cross-session memory for the in-ride coach.
 *
 * Follows the system_prompt_cid pattern (ARCHITECTURE.md §1): the memory
 * document lives as a Walrus blob; the app keeps only a content-addressed
 * pointer (blob ID) per rider+coach pair. Walrus blobs are immutable, so
 * every save produces a new blob ID and the pointer advances.
 *
 * v1 storage topology:
 * - Walrus blob: the memory document (source of truth when reachable).
 * - localStorage pointer: `spinchain:coach-memory:{riderId}:{coachId}` → blobId.
 * - localStorage cache: `...:cache` → last known memory JSON, used only
 *   when Walrus is unreachable (offline-first read, flagged pendingSync
 *   on write). This is a cache, not a scaling path — multi-device sync
 *   needs the pointer anchored on-chain (Sui Coach struct) or in Supabase.
 *
 * Pure helpers (createInitialMemory / parseCoachMemory /
 * updateMemoryAfterRide) are network-free and unit-tested.
 */

import { getWalrusClient } from "./client";

export interface CoachRideSummary {
  avgPower: number;
  durationSec: number;
  completed: boolean;
}

export interface CoachMemory {
  version: 1;
  riderId: string;
  coachId: string;
  rides: number;
  lastRideAt: number | null;
  lastRide: CoachRideSummary | null;
  bestAvgPower: number;
  /** Coach observations, newest first, capped at 5. */
  notes: string[];
}

const MAX_NOTES = 5;

// ─── Pure helpers ────────────────────────────────────────────────

export function createInitialMemory(riderId: string, coachId: string): CoachMemory {
  return {
    version: 1,
    riderId,
    coachId,
    rides: 0,
    lastRideAt: null,
    lastRide: null,
    bestAvgPower: 0,
    notes: [],
  };
}

/** Structural validation for blobs fetched from Walrus. */
export function parseCoachMemory(raw: unknown): CoachMemory | null {
  if (typeof raw !== "object" || raw === null) return null;
  const m = raw as Record<string, unknown>;

  if (m.version !== 1) return null;
  if (typeof m.riderId !== "string" || m.riderId.length === 0) return null;
  if (typeof m.coachId !== "string" || m.coachId.length === 0) return null;
  if (typeof m.rides !== "number" || !Number.isFinite(m.rides) || m.rides < 0) return null;
  if (typeof m.bestAvgPower !== "number" || !Number.isFinite(m.bestAvgPower)) return null;
  if (m.lastRideAt !== null && typeof m.lastRideAt !== "number") return null;
  if (!Array.isArray(m.notes) || !m.notes.every((n) => typeof n === "string")) return null;

  if (m.lastRide !== null) {
    const r = m.lastRide as Record<string, unknown> | null;
    if (
      typeof r !== "object" || r === null ||
      typeof r.avgPower !== "number" || !Number.isFinite(r.avgPower) ||
      typeof r.durationSec !== "number" || !Number.isFinite(r.durationSec) ||
      typeof r.completed !== "boolean"
    ) {
      return null;
    }
  }

  return raw as CoachMemory;
}

/**
 * Fold a finished ride into the memory. Pure — returns a new object.
 * `note` is an optional coach observation (e.g. "new best average power").
 */
export function updateMemoryAfterRide(
  memory: CoachMemory,
  summary: CoachRideSummary,
  note?: string,
  now: number = Date.now(),
): CoachMemory {
  const notes = [...memory.notes];
  if (note && notes[0] !== note) {
    notes.unshift(note);
    if (notes.length > MAX_NOTES) notes.length = MAX_NOTES;
  }
  return {
    ...memory,
    rides: memory.rides + 1,
    lastRideAt: now,
    lastRide: { ...summary },
    bestAvgPower: Math.max(memory.bestAvgPower, summary.avgPower),
    notes,
  };
}

// ─── Persistence ─────────────────────────────────────────────────

function pointerKey(riderId: string, coachId: string): string {
  return `spinchain:coach-memory:${riderId}:${coachId}`;
}

function cacheKey(riderId: string, coachId: string): string {
  return `${pointerKey(riderId, coachId)}:cache`;
}

function readCache(riderId: string, coachId: string): CoachMemory | null {
  try {
    const raw = localStorage.getItem(cacheKey(riderId, coachId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { memory?: unknown };
    return parseCoachMemory(parsed.memory ?? null);
  } catch {
    return null;
  }
}

function writeCache(riderId: string, coachId: string, memory: CoachMemory, pendingSync: boolean): void {
  try {
    localStorage.setItem(
      cacheKey(riderId, coachId),
      JSON.stringify({ memory, pendingSync, updatedAt: Date.now() }),
    );
  } catch {
    // storage full or blocked — non-fatal
  }
}

/** Bound on Walrus read latency so a slow aggregator can't delay ride start. */
const WALRUS_LOAD_TIMEOUT_MS = 2_500;

/**
 * Load the memory for a rider+coach pair. Tries the Walrus blob referenced
 * by the local pointer first (with a hard timeout — an unreachable
 * aggregator must not eat the in-ride greeting window), then the local
 * cache. Returns null for a first-ever ride. Never throws; browser-only
 * (returns null during SSR).
 */
export async function loadCoachMemory(
  riderId: string,
  coachId: string,
): Promise<CoachMemory | null> {
  if (typeof window === "undefined") return null;

  let blobId: string | null = null;
  try {
    blobId = localStorage.getItem(pointerKey(riderId, coachId));
  } catch {
    // blocked storage — try network-less path only
  }

  if (blobId) {
    const result = await Promise.race([
      getWalrusClient().retrieveJSON<unknown>(blobId),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), WALRUS_LOAD_TIMEOUT_MS),
      ),
    ]);
    if (result && result.success) {
      const memory = parseCoachMemory(result.data);
      if (memory) {
        writeCache(riderId, coachId, memory, false);
        return memory;
      }
      console.warn("[CoachMemory] Blob failed validation, falling back to cache");
    }
  }

  return readCache(riderId, coachId);
}

export type SaveCoachMemoryResult = {
  persisted: "walrus" | "local";
  blobId: string | null;
};

/**
 * Persist a memory update. Walrus first; on failure the local cache is
 * written with pendingSync so a later save can retry. Never throws.
 */
export async function saveCoachMemory(memory: CoachMemory): Promise<SaveCoachMemoryResult> {
  if (typeof window === "undefined") return { persisted: "local", blobId: null };

  const { riderId, coachId } = memory;
  try {
    const result = await getWalrusClient().storeJSON(memory);
    if (result.success && result.blobId) {
      try {
        localStorage.setItem(pointerKey(riderId, coachId), result.blobId);
      } catch {
        // non-fatal
      }
      writeCache(riderId, coachId, memory, false);
      return { persisted: "walrus", blobId: result.blobId };
    }
  } catch (err) {
    console.warn("[CoachMemory] Walrus store failed:", err);
  }

  writeCache(riderId, coachId, memory, true);
  return { persisted: "local", blobId: null };
}
