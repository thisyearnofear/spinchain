type PrivacyTier = "high" | "medium" | "low";

export interface LeaderboardEntry {
  rank: number;
  riderId: string;
  effortScore?: number;
  durationSec?: number;
  completedAt: number;
  privacyTier: PrivacyTier;
}

export interface LeaderboardSubmission {
  idempotencyKey: string;
  riderId: string;
  classId: string;
  effortScore: number;
  durationSec: number;
  completedAt: number;
  privacyTier: PrivacyTier;
}

const MAX_ENTRIES_PER_CLASS = 100;
const ENTRY_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredEntry extends LeaderboardEntry {
  expiresAt: number;
  idempotencyKey: string;
}

const classEntries = new Map<string, StoredEntry[]>();

function evict(classId: string): void {
  const now = Date.now();
  const entries = classEntries.get(classId);
  if (!entries) return;
  const live = entries.filter((e) => e.expiresAt > now);
  live.length ? classEntries.set(classId, live) : classEntries.delete(classId);
}

export function upsertLeaderboardEntry(sub: LeaderboardSubmission): void {
  evict(sub.classId);
  const existing = classEntries.get(sub.classId) ?? [];
  const deduped = existing.filter((e) => e.idempotencyKey !== sub.idempotencyKey);

  const riderId =
    sub.privacyTier === "high"
      ? `${sub.riderId.slice(0, 6)}…${sub.riderId.slice(-4)}`
      : sub.riderId;

  deduped.push({
    rank: 0,
    riderId,
    effortScore: sub.effortScore,
    durationSec: sub.durationSec,
    completedAt: sub.completedAt,
    privacyTier: sub.privacyTier,
    expiresAt: Date.now() + ENTRY_TTL_MS,
    idempotencyKey: sub.idempotencyKey,
  });

  deduped.sort((a, b) => (b.effortScore ?? 0) - (a.effortScore ?? 0));
  classEntries.set(sub.classId, deduped.slice(0, MAX_ENTRIES_PER_CLASS));
}

export function getLeaderboard(classId: string): LeaderboardEntry[] {
  evict(classId);
  return (classEntries.get(classId) ?? []).map((e, i) => ({
    rank: i + 1,
    riderId: e.riderId,
    effortScore: e.effortScore,
    durationSec: e.durationSec,
    completedAt: e.completedAt,
    privacyTier: e.privacyTier,
  }));
}

export function hasLeaderboardEntries(classId: string): boolean {
  evict(classId);
  return (classEntries.get(classId)?.length ?? 0) > 0;
}
