export interface RideProofSummary {
  mode: "zk-batch" | "yellow-stream" | "none";
  isVerified: boolean;
  privacyScore: number;
  privacyLevel: "high" | "medium" | "low";
}

export type RideSyncStatus = "local_only" | "queued" | "relayed" | "anchored" | "failed";

export interface RideSummary {
  schemaVersion: "1.0";
  id: string;
  idempotencyKey: string;
  riderId: string;
  classId: string;
  className: string;
  instructor: string;
  completedAt: number;
  durationSec: number;
  avgHeartRate: number;
  avgPower: number;
  avgEffort: number;
  spinEarned: number;
  telemetrySource: "live-bike" | "simulator" | "estimated";
  effortTier: "bronze" | "silver" | "gold" | "platinum";
  zones: {
    recovery: number;
    endurance: number;
    threshold: number;
    sprint: number;
  };
  proof: RideProofSummary;
  sync: {
    status: RideSyncStatus;
    retryCount: number;
    lastAttemptAt?: number;
    relayedAt?: number;
    anchoredAt?: number;
    nextRetryAt?: number;
    error?: string;
  };
  onChain?: {
    attempted: boolean;
    txHash?: `0x${string}`;
    status: "pending" | "confirmed" | "failed" | "skipped";
    commitmentEpoch?: number;
  };
}

export interface RideSyncQueueItem {
  id: string;
  idempotencyKey: string;
  status: RideSyncStatus;
  retryCount: number;
  nextRetryAt: number;
  lastError?: string;
}

export interface WeeklyGoalProgress {
  targetRides: number;
  completedRides: number;
  remainingRides: number;
  completionRate: number;
}

export interface BadgeUnlockEvent {
  name: string;
  unlockedAt: number;
}

export interface RetentionSignals {
  weeklyGoal: WeeklyGoalProgress;
  streaks: { daily: number; weekly: number; activeToday: boolean };
  unlockedBadges: BadgeUnlockEvent[];
  ctaPrimary: "view_history" | "ride_again";
}

const STORAGE_KEY = "spinchain:rides:history:v2";
const LEGACY_STORAGE_KEY = "spinchain:rides:history:v1";
const QUEUE_STORAGE_KEY = "spinchain:rides:sync-queue:v1";
const MAX_RIDES = 200;
const MAX_RETRIES = 6;
const BASE_BACKOFF_MS = 15_000;
export const PERFORMANCE_GATES = {
  rideSaveLatencyMs: 200,
  journeyCacheLoadMs: 300,
};

const hasWindow = () => typeof window !== "undefined";

function safeParse<T>(input: string | null, fallback: T): T {
  if (!input) return fallback;
  try {
    const parsed = JSON.parse(input);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toRideSummary(value: unknown): RideSummary | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.classId !== "string" || typeof value.completedAt !== "number") {
    return null;
  }

  const proof = isRecord(value.proof) ? value.proof : {};
  const sync = isRecord(value.sync) ? value.sync : {};
  const onChain = isRecord(value.onChain) ? value.onChain : undefined;

  const riderId = typeof value.riderId === "string" ? value.riderId : "guest";
  const idempotencyKey = typeof value.idempotencyKey === "string"
    ? value.idempotencyKey
    : createRideIdempotencyKey(value.id as string, riderId, value.completedAt as number);

  return {
    schemaVersion: "1.0",
    id: value.id,
    idempotencyKey,
    riderId,
    classId: value.classId,
    className: typeof value.className === "string" ? value.className : "SpinChain Ride",
    instructor: typeof value.instructor === "string" ? value.instructor : "Coach",
    completedAt: value.completedAt,
    durationSec: typeof value.durationSec === "number" ? value.durationSec : 0,
    avgHeartRate: typeof value.avgHeartRate === "number" ? value.avgHeartRate : 0,
    avgPower: typeof value.avgPower === "number" ? value.avgPower : 0,
    avgEffort: typeof value.avgEffort === "number" ? value.avgEffort : 0,
    spinEarned: typeof value.spinEarned === "number" ? value.spinEarned : 0,
    telemetrySource: value.telemetrySource === "live-bike" || value.telemetrySource === "simulator" ? value.telemetrySource : "estimated",
    effortTier: value.effortTier === "platinum" || value.effortTier === "gold" || value.effortTier === "silver" ? value.effortTier : "bronze",
    zones: {
      recovery: Number(isRecord(value.zones) ? value.zones.recovery : 0) || 0,
      endurance: Number(isRecord(value.zones) ? value.zones.endurance : 0) || 0,
      threshold: Number(isRecord(value.zones) ? value.zones.threshold : 0) || 0,
      sprint: Number(isRecord(value.zones) ? value.zones.sprint : 0) || 0,
    },
    proof: {
      mode: proof.mode === "zk-batch" || proof.mode === "yellow-stream" ? proof.mode : "none",
      isVerified: Boolean(proof.isVerified),
      privacyScore: typeof proof.privacyScore === "number" ? proof.privacyScore : 0,
      privacyLevel: proof.privacyLevel === "high" || proof.privacyLevel === "medium" ? proof.privacyLevel : "low",
    },
    sync: {
      status: sync.status === "queued" || sync.status === "relayed" || sync.status === "anchored" || sync.status === "failed" ? sync.status : "local_only",
      retryCount: typeof sync.retryCount === "number" ? sync.retryCount : 0,
      lastAttemptAt: typeof sync.lastAttemptAt === "number" ? sync.lastAttemptAt : undefined,
      relayedAt: typeof sync.relayedAt === "number" ? sync.relayedAt : undefined,
      anchoredAt: typeof sync.anchoredAt === "number" ? sync.anchoredAt : undefined,
      nextRetryAt: typeof sync.nextRetryAt === "number" ? sync.nextRetryAt : undefined,
      error: typeof sync.error === "string" ? sync.error : undefined,
    },
    onChain: onChain
      ? {
          attempted: Boolean(onChain.attempted),
          txHash: typeof onChain.txHash === "string" ? (onChain.txHash as `0x${string}`) : undefined,
          status: onChain.status === "confirmed" || onChain.status === "failed" || onChain.status === "skipped" ? onChain.status : "pending",
          commitmentEpoch: typeof onChain.commitmentEpoch === "number" ? onChain.commitmentEpoch : undefined,
        }
      : undefined,
  };
}

function writeRideHistory(rides: RideSummary[]) {
  if (!hasWindow()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rides));
}

function readRideHistoryRaw(): RideSummary[] {
  if (!hasWindow()) return [];
  const parsed = safeParse<unknown[]>(window.localStorage.getItem(STORAGE_KEY), []);
  return parsed.map(toRideSummary).filter((ride): ride is RideSummary => Boolean(ride));
}

function migrateLegacyIfNeeded() {
  if (!hasWindow()) return;
  if (window.localStorage.getItem(STORAGE_KEY)) return;
  const legacy = safeParse<unknown[]>(window.localStorage.getItem(LEGACY_STORAGE_KEY), []);
  if (!legacy.length) return;
  const migrated = legacy
    .map((ride) => {
      if (!isRecord(ride)) return null;
      return toRideSummary({ ...ride, sync: { status: "local_only", retryCount: 0 } });
    })
    .filter((ride): ride is RideSummary => Boolean(ride));
  if (migrated.length) {
    writeRideHistory(migrated);
  }
}

function readQueue(): RideSyncQueueItem[] {
  if (!hasWindow()) return [];
  const parsed = safeParse<unknown[]>(window.localStorage.getItem(QUEUE_STORAGE_KEY), []);
  return parsed
    .map((item) => {
      if (!isRecord(item) || typeof item.id !== "string" || typeof item.idempotencyKey !== "string") return null;
      return {
        id: item.id,
        idempotencyKey: item.idempotencyKey,
        status: item.status === "failed" || item.status === "relayed" || item.status === "anchored" ? item.status : "queued",
        retryCount: typeof item.retryCount === "number" ? item.retryCount : 0,
        nextRetryAt: typeof item.nextRetryAt === "number" ? item.nextRetryAt : Date.now(),
        lastError: typeof item.lastError === "string" ? item.lastError : undefined,
      } as RideSyncQueueItem;
    })
    .filter((item): item is RideSyncQueueItem => Boolean(item));
}

function writeQueue(items: RideSyncQueueItem[]) {
  if (!hasWindow()) return;
  window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(items));
}

function mergeRide(summary: RideSummary): RideSummary[] {
  const existing = getRideHistory().filter((r) => r.id !== summary.id && r.idempotencyKey !== summary.idempotencyKey);
  const next = [summary, ...existing].slice(0, MAX_RIDES);
  writeRideHistory(next);
  return next;
}

function updateRideById(id: string, update: (ride: RideSummary) => RideSummary): RideSummary | null {
  const rides = getRideHistory();
  let updated: RideSummary | null = null;
  const next = rides.map((ride) => {
    if (ride.id !== id) return ride;
    updated = update(ride);
    return updated;
  });
  if (!updated) return null;
  writeRideHistory(next);
  return updated;
}

function queueOrUpdate(item: RideSyncQueueItem) {
  const queue = readQueue();
  const next = [item, ...queue.filter((q) => q.id !== item.id && q.idempotencyKey !== item.idempotencyKey)];
  writeQueue(next);
}

function removeFromQueue(id: string) {
  writeQueue(readQueue().filter((q) => q.id !== id));
}

function nextRetryDelayMs(retryCount: number) {
  return BASE_BACKOFF_MS * 2 ** Math.min(retryCount, 5);
}

function createMockAnchorEpoch(timestamp: number): number {
  return Math.floor(timestamp / (1000 * 60 * 30));
}

export function createRideIdempotencyKey(rideId: string, riderId: string, endedAt: number) {
  return `${rideId}:${riderId}:${endedAt}`;
}

export function createCanonicalRideSummary(input: Omit<RideSummary, "schemaVersion" | "idempotencyKey" | "sync">): RideSummary {
  return {
    ...input,
    schemaVersion: "1.0",
    idempotencyKey: createRideIdempotencyKey(input.id, input.riderId, input.completedAt),
    sync: {
      status: "local_only",
      retryCount: 0,
    },
  };
}

export function getRideHistory(): RideSummary[] {
  if (!hasWindow()) return [];
  const start = hasWindow() && typeof window.performance !== "undefined" ? window.performance.now() : 0;
  migrateLegacyIfNeeded();
  const rides = readRideHistoryRaw().sort((a, b) => b.completedAt - a.completedAt);
  if (start > 0) {
    const elapsed = window.performance.now() - start;
    if (elapsed > PERFORMANCE_GATES.journeyCacheLoadMs) {
      console.warn(`[Journey] Cache load exceeded gate: ${Math.round(elapsed)}ms > ${PERFORMANCE_GATES.journeyCacheLoadMs}ms`);
    }
  }
  return rides;
}

export function saveRideSummary(summary: RideSummary): RideSummary[] {
  if (!hasWindow()) return [];
  const start = typeof window.performance !== "undefined" ? window.performance.now() : 0;
  const result = mergeRide(summary);
  if (start > 0) {
    const elapsed = window.performance.now() - start;
    if (elapsed > PERFORMANCE_GATES.rideSaveLatencyMs) {
      console.warn(`[Ride] Save latency exceeded gate: ${Math.round(elapsed)}ms > ${PERFORMANCE_GATES.rideSaveLatencyMs}ms`);
    }
  }
  return result;
}

export function enqueueRideSync(summary: RideSummary): RideSummary {
  const queued = {
    ...summary,
    sync: {
      ...summary.sync,
      status: "queued" as const,
      nextRetryAt: Date.now(),
    },
  };
  mergeRide(queued);
  queueOrUpdate({
    id: queued.id,
    idempotencyKey: queued.idempotencyKey,
    status: "queued",
    retryCount: queued.sync.retryCount,
    nextRetryAt: Date.now(),
  });
  return queued;
}

type RelaySyncResult = {
  relayed: boolean;
  commitmentTxHash?: `0x${string}`;
};

async function relayRideSummary(summary: RideSummary): Promise<RelaySyncResult> {
  const response = await fetch("/api/rides/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(summary),
  });
  if (!response.ok) {
    throw new Error(`Relay failed (${response.status})`);
  }
  const data = (await response.json()) as { relayed: boolean; commitmentTxHash?: `0x${string}` };
  return { relayed: data.relayed, commitmentTxHash: data.commitmentTxHash };
}

export async function processRideSyncQueue(now = Date.now()) {
  if (!hasWindow()) return;
  if (!navigator.onLine) return;

  const queue = readQueue();
  const dueItems = queue.filter((item) => item.status === "queued" && item.nextRetryAt <= now);
  if (!dueItems.length) return;

  for (const item of dueItems) {
    const ride = getRideHistory().find((entry) => entry.id === item.id);
    if (!ride) {
      removeFromQueue(item.id);
      continue;
    }

    updateRideById(item.id, (current) => ({
      ...current,
      sync: {
        ...current.sync,
        status: "queued",
        lastAttemptAt: now,
      },
    }));

    try {
      const relayResult = await relayRideSummary(ride);
      const relayedAt = Date.now();
      const anchored = Boolean(relayResult.commitmentTxHash);
      updateRideById(item.id, (current) => ({
        ...current,
        sync: {
          ...current.sync,
          status: anchored ? "anchored" : "relayed",
          relayedAt,
          anchoredAt: anchored ? relayedAt : current.sync.anchoredAt,
          error: undefined,
        },
        onChain: {
          attempted: true,
          status: anchored ? "confirmed" : "pending",
          txHash: relayResult.commitmentTxHash,
          commitmentEpoch: createMockAnchorEpoch(relayedAt),
        },
      }));
      removeFromQueue(item.id);
    } catch (error) {
      const retryCount = item.retryCount + 1;
      const terminal = retryCount >= MAX_RETRIES;
      const nextRetryAt = Date.now() + nextRetryDelayMs(retryCount);
      const message = error instanceof Error ? error.message : "Sync failed";
      updateRideById(item.id, (current) => ({
        ...current,
        sync: {
          ...current.sync,
          status: terminal ? "failed" : "queued",
          retryCount,
          nextRetryAt,
          error: message,
        },
      }));
      if (terminal) {
        removeFromQueue(item.id);
      } else {
        queueOrUpdate({
          ...item,
          status: "queued",
          retryCount,
          nextRetryAt,
          lastError: message,
        });
      }
    }
  }
}

export function getSyncQueueSnapshot() {
  return readQueue();
}

export function getStreakStats(rides: RideSummary[]) {
  if (!rides.length) return { daily: 0, weekly: 0, activeToday: false };
  const daySet = new Set(
    rides.map((ride) => {
      const date = new Date(ride.completedAt);
      return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
    }),
  );

  const now = new Date();
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  let daily = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const d = new Date(startOfToday - offset * 86_400_000);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    if (!daySet.has(key)) break;
    daily += 1;
  }

  const weekSet = new Set(
    rides.map((ride) => {
      const d = new Date(ride.completedAt);
      const onejan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86_400_000) + onejan.getUTCDay() + 1) / 7);
      return `${d.getUTCFullYear()}-${week}`;
    }),
  );
  let weekly = 0;
  for (let offset = 0; offset < 52; offset += 1) {
    const d = new Date(startOfToday - offset * 7 * 86_400_000);
    const onejan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86_400_000) + onejan.getUTCDay() + 1) / 7);
    const key = `${d.getUTCFullYear()}-${week}`;
    if (!weekSet.has(key)) break;
    weekly += 1;
  }

  return { daily, weekly, activeToday: daily > 0 };
}

export function getPRs(rides: RideSummary[]) {
  return {
    bestEffort: rides.reduce((acc, r) => Math.max(acc, r.avgEffort), 0),
    bestPower: rides.reduce((acc, r) => Math.max(acc, r.avgPower), 0),
    bestDuration: rides.reduce((acc, r) => Math.max(acc, r.durationSec), 0),
    bestSpin: rides.reduce((acc, r) => Math.max(acc, r.spinEarned), 0),
  };
}

export function getBadges(rides: RideSummary[]) {
  const prs = getPRs(rides);
  const latest = rides[0];
  if (!latest) return [] as string[];
  const badges: string[] = [];
  if (latest.avgEffort >= prs.bestEffort) badges.push("PR Effort");
  if (latest.avgPower >= prs.bestPower) badges.push("PR Power");
  if (latest.zones.threshold + latest.zones.sprint >= 50) badges.push("Zone Hunter");
  if (latest.avgEffort >= 800) badges.push("Tier Elite");
  else if (latest.avgEffort >= 650) badges.push("Tier Strong");
  return badges;
}

function getWeekKey(ts: number) {
  const d = new Date(ts);
  const onejan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86_400_000) + onejan.getUTCDay() + 1) / 7);
  return `${d.getUTCFullYear()}-${week}`;
}

export function getWeeklyGoalProgress(rides: RideSummary[], targetRides = 4): WeeklyGoalProgress {
  if (!rides.length) {
    return { targetRides, completedRides: 0, remainingRides: targetRides, completionRate: 0 };
  }
  const currentWeek = getWeekKey(Date.now());
  const completedRides = rides.filter((ride) => getWeekKey(ride.completedAt) === currentWeek).length;
  const remainingRides = Math.max(0, targetRides - completedRides);
  return {
    targetRides,
    completedRides,
    remainingRides,
    completionRate: Math.min(1, completedRides / targetRides),
  };
}

export function getBadgeUnlockEvents(rides: RideSummary[]): BadgeUnlockEvent[] {
  const events: BadgeUnlockEvent[] = [];
  const seen = new Set<string>();
  const sorted = [...rides].sort((a, b) => a.completedAt - b.completedAt);
  for (const ride of sorted) {
    const rideBadges = getBadges(sorted.filter((candidate) => candidate.completedAt <= ride.completedAt));
    for (const badge of rideBadges) {
      if (seen.has(badge)) continue;
      seen.add(badge);
      events.push({ name: badge, unlockedAt: ride.completedAt });
    }
  }
  return events;
}

export function getRetentionSignals(rides: RideSummary[]): RetentionSignals {
  const streaks = getStreakStats(rides);
  const weeklyGoal = getWeeklyGoalProgress(rides);
  const unlockedBadges = getBadgeUnlockEvents(rides);
  const latest = rides[0];
  const latestBadges = latest ? getBadges(rides) : [];
  const ctaPrimary = latestBadges.length > 0 || streaks.activeToday || weeklyGoal.completionRate >= 1
    ? "view_history"
    : "ride_again";

  return {
    weeklyGoal,
    streaks,
    unlockedBadges,
    ctaPrimary,
  };
}

export interface LeaderboardEntry {
  rank: number;
  riderLabel: string;
  effort: number;
  spin: number;
  verified: boolean;
  proofType: RideProofSummary["mode"];
}

export interface LeaderboardSnapshot {
  entries: LeaderboardEntry[];
  source: "remote" | "local-fallback";
  commitment: {
    epoch: number | null;
    anchoredAt: number | null;
    txHash?: `0x${string}`;
  };
}

async function fetchRemoteLeaderboard(classId: string): Promise<LeaderboardSnapshot | null> {
  if (!classId) return null;
  try {
    const response = await fetch(`/api/rides/leaderboard?classId=${encodeURIComponent(classId)}`);
    if (!response.ok) return null;
    const payload = (await response.json()) as LeaderboardSnapshot;
    return payload;
  } catch {
    return null;
  }
}

export function getClassLeaderboard(rides: RideSummary[], classId: string): LeaderboardEntry[] {
  return rides
    .filter((ride) => ride.classId === classId)
    .sort((a, b) => b.avgEffort - a.avgEffort)
    .slice(0, 10)
    .map((ride, index) => ({
      rank: index + 1,
      riderLabel: ride.riderId === "guest" ? `Guest-${ride.id.slice(-4)}` : ride.riderId,
      effort: ride.avgEffort,
      spin: ride.spinEarned,
      verified: ride.proof.isVerified,
      proofType: ride.proof.mode,
    }));
}

export async function getLeaderboardSnapshot(rides: RideSummary[], classId: string): Promise<LeaderboardSnapshot> {
  const remote = await fetchRemoteLeaderboard(classId);
  if (remote && remote.entries.length > 0) {
    return remote;
  }
  const localEntries = getClassLeaderboard(rides, classId);
  const latestAnchored = rides.find((ride) => ride.sync.status === "anchored" && ride.onChain?.commitmentEpoch);
  return {
    entries: localEntries,
    source: "local-fallback",
    commitment: {
      epoch: latestAnchored?.onChain?.commitmentEpoch ?? null,
      anchoredAt: latestAnchored?.sync.anchoredAt ?? null,
      txHash: latestAnchored?.onChain?.txHash,
    },
  };
}
