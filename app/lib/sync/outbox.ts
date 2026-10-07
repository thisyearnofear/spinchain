"use client";

import { hasConsent, type ConsentScope } from "@/app/lib/privacy/consent";

/**
 * Durable client outbox. Jobs survive reloads and are drained from the app
 * root (not the finish screen), one tab at a time, with exponential backoff.
 * Consent-scoped jobs wait in `held_consent` instead of being dropped, and are
 * released on grant / removed on revoke.
 */

export type OutboxJobKind = "cloud_history.upsert";

export type OutboxJobStatus = "queued" | "in_flight" | "done" | "failed" | "dead" | "held_consent";

export interface OutboxJob {
  id: string;
  kind: OutboxJobKind;
  idempotencyKey: string;
  rideId: string;
  requiredConsent?: ConsentScope;
  status: OutboxJobStatus;
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
  updatedAt: number;
  lastError?: string;
}

/** "skip" = nothing to do (e.g. ride gone, guest rider); the job is removed. */
export type OutboxJobOutcome = "done" | "skip" | "held_consent";
export type OutboxHandler = (job: OutboxJob) => Promise<OutboxJobOutcome>;
export type OutboxHandlers = Partial<Record<OutboxJobKind, OutboxHandler>>;

export const OUTBOX_STORAGE_KEY = "spinchain:outbox:v1";
export const OUTBOX_LEASE_KEY = "spinchain:outbox:lease:v1";
export const OUTBOX_CHANGED_EVENT = "spinchain:outbox-changed";
export const OUTBOX_MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 15_000;
const MAX_BACKOFF_MS = 30 * 60_000;
const LEASE_MS = 30_000;
const DONE_TTL_MS = 30 * 24 * 60 * 60_000;
const MAX_JOBS = 500;
const LOCK_NAME = "spinchain-outbox";

const STATUSES: readonly OutboxJobStatus[] = ["queued", "in_flight", "done", "failed", "dead", "held_consent"];

function isClient() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function outboxBackoffMs(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
}

function parseJob(raw: unknown): OutboxJob | null {
  if (!raw || typeof raw !== "object") return null;
  const j = raw as Partial<OutboxJob>;
  if (typeof j.id !== "string" || j.kind !== "cloud_history.upsert") return null;
  if (typeof j.idempotencyKey !== "string" || typeof j.rideId !== "string") return null;
  return {
    id: j.id,
    kind: j.kind,
    idempotencyKey: j.idempotencyKey,
    rideId: j.rideId,
    requiredConsent: j.requiredConsent,
    status: STATUSES.includes(j.status as OutboxJobStatus) ? (j.status as OutboxJobStatus) : "queued",
    attempts: typeof j.attempts === "number" ? j.attempts : 0,
    nextAttemptAt: typeof j.nextAttemptAt === "number" ? j.nextAttemptAt : 0,
    createdAt: typeof j.createdAt === "number" ? j.createdAt : 0,
    updatedAt: typeof j.updatedAt === "number" ? j.updatedAt : 0,
    lastError: typeof j.lastError === "string" ? j.lastError : undefined,
  };
}

export function readOutbox(): OutboxJob[] {
  if (!isClient()) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(OUTBOX_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.map(parseJob).filter((j): j is OutboxJob => j !== null) : [];
  } catch {
    return [];
  }
}

function writeOutbox(jobs: OutboxJob[]) {
  localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(jobs.slice(0, MAX_JOBS)));
  window.dispatchEvent(new Event(OUTBOX_CHANGED_EVENT));
}

function patchJob(id: string, patch: Partial<OutboxJob>) {
  const jobs = readOutbox();
  const i = jobs.findIndex((j) => j.id === id);
  if (i === -1) return;
  jobs[i] = { ...jobs[i], ...patch, updatedAt: Date.now() };
  writeOutbox(jobs);
}

function removeJob(id: string) {
  writeOutbox(readOutbox().filter((j) => j.id !== id));
}

export interface EnqueueInput {
  kind: OutboxJobKind;
  idempotencyKey: string;
  rideId: string;
  requiredConsent?: ConsentScope;
}

/**
 * Idempotent on (kind, idempotencyKey). An existing job is left alone unless
 * `revive` is set, which resets failed/dead/done jobs to a fresh attempt.
 */
export function enqueueOutboxJob(input: EnqueueInput, opts: { revive?: boolean } = {}): OutboxJob | null {
  if (!isClient()) return null;
  const id = `${input.kind}:${input.idempotencyKey}`;
  const now = Date.now();
  const jobs = readOutbox();
  const existing = jobs.find((j) => j.id === id);
  const initialStatus: OutboxJobStatus =
    input.requiredConsent && !hasConsent(input.requiredConsent) ? "held_consent" : "queued";

  if (existing) {
    const revivable = existing.status === "failed" || existing.status === "dead" || existing.status === "done";
    if (!opts.revive || !revivable) return existing;
    const revived = { ...existing, status: initialStatus, attempts: 0, nextAttemptAt: now, updatedAt: now, lastError: undefined };
    writeOutbox(jobs.map((j) => (j.id === id ? revived : j)));
    return revived;
  }

  const job: OutboxJob = { id, ...input, status: initialStatus, attempts: 0, nextAttemptAt: now, createdAt: now, updatedAt: now };
  writeOutbox([job, ...jobs]);
  return job;
}

/** Release held jobs on grant; drop not-yet-sent jobs on revoke. */
export function applyConsentToOutbox(scope: ConsentScope, granted: boolean) {
  if (!isClient()) return;
  const now = Date.now();
  const jobs = readOutbox();
  const next = granted
    ? jobs.map((j) =>
        j.requiredConsent === scope && j.status === "held_consent"
          ? { ...j, status: "queued" as const, nextAttemptAt: now, updatedAt: now }
          : j,
      )
    : jobs.filter((j) => j.requiredConsent !== scope || j.status === "done");
  writeOutbox(next);
}

/** Manual retry for failed/dead jobs. */
export function retryOutboxJobs() {
  if (!isClient()) return;
  const now = Date.now();
  writeOutbox(
    readOutbox().map((j) =>
      j.status === "failed" || j.status === "dead"
        ? { ...j, status: "queued" as const, attempts: 0, nextAttemptAt: now, updatedAt: now, lastError: undefined }
        : j,
    ),
  );
}

// ─── Single-drainer lock ──────────────────────────────────────────────

const tabId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

async function withDrainLock(fn: () => Promise<void>): Promise<boolean> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (locks?.request) {
    return locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
      if (!lock) return false;
      await fn();
      return true;
    });
  }
  // Fallback: short localStorage lease, re-read to settle simultaneous writers.
  const now = Date.now();
  try {
    const lease = JSON.parse(localStorage.getItem(OUTBOX_LEASE_KEY) ?? "null") as { owner: string; expiresAt: number } | null;
    if (lease && lease.owner !== tabId && lease.expiresAt > now) return false;
  } catch {
    // corrupt lease → take it
  }
  localStorage.setItem(OUTBOX_LEASE_KEY, JSON.stringify({ owner: tabId, expiresAt: now + LEASE_MS }));
  if (JSON.parse(localStorage.getItem(OUTBOX_LEASE_KEY) ?? "null")?.owner !== tabId) return false;
  try {
    await fn();
    return true;
  } finally {
    if (JSON.parse(localStorage.getItem(OUTBOX_LEASE_KEY) ?? "null")?.owner === tabId) {
      localStorage.removeItem(OUTBOX_LEASE_KEY);
    }
  }
}

let inFlightDrain: Promise<void> | null = null;

export function drainOutbox(handlers: OutboxHandlers): Promise<void> {
  if (!isClient()) return Promise.resolve();
  if (typeof navigator !== "undefined" && navigator.onLine === false) return Promise.resolve();
  if (inFlightDrain) return inFlightDrain;
  inFlightDrain = withDrainLock(() => runDrain(handlers))
    .then(() => undefined)
    .finally(() => {
      inFlightDrain = null;
    });
  return inFlightDrain;
}

async function runDrain(handlers: OutboxHandlers) {
  const startedAt = Date.now();

  // We hold the lock, so any in_flight job was orphaned by a crash/reload.
  // Also release held jobs whose consent now exists, and prune old done jobs.
  writeOutbox(
    readOutbox()
      .filter((j) => !(j.status === "done" && startedAt - j.updatedAt > DONE_TTL_MS))
      .map((j) => {
        if (j.status === "in_flight") return { ...j, status: "queued" as const };
        if (j.status === "held_consent" && j.requiredConsent && hasConsent(j.requiredConsent)) {
          return { ...j, status: "queued" as const, nextAttemptAt: startedAt };
        }
        return j;
      }),
  );

  const due = readOutbox().filter(
    (j) => (j.status === "queued" || j.status === "failed") && j.nextAttemptAt <= startedAt && handlers[j.kind],
  );

  for (const job of due) {
    // Re-read: consent may have been revoked or the job removed mid-drain.
    const current = readOutbox().find((j) => j.id === job.id);
    if (!current || (current.status !== "queued" && current.status !== "failed")) continue;
    if (current.requiredConsent && !hasConsent(current.requiredConsent)) {
      patchJob(current.id, { status: "held_consent" });
      continue;
    }

    patchJob(current.id, { status: "in_flight" });
    try {
      const outcome = await handlers[current.kind]!(current);
      if (outcome === "skip") removeJob(current.id);
      else patchJob(current.id, { status: outcome, lastError: undefined });
    } catch (err) {
      const attempts = current.attempts + 1;
      const dead = attempts >= OUTBOX_MAX_ATTEMPTS;
      patchJob(current.id, {
        status: dead ? "dead" : "failed",
        attempts,
        nextAttemptAt: Date.now() + outboxBackoffMs(attempts),
        lastError: err instanceof Error ? err.message : "Job failed",
      });
    }
  }
}

export interface OutboxSummary {
  pending: number;
  held: number;
  failed: number;
  dead: number;
  done: number;
}

export function getOutboxSummary(): OutboxSummary {
  const s: OutboxSummary = { pending: 0, held: 0, failed: 0, dead: 0, done: 0 };
  for (const j of readOutbox()) {
    if (j.status === "queued" || j.status === "in_flight") s.pending++;
    else if (j.status === "held_consent") s.held++;
    else if (j.status === "failed") s.failed++;
    else if (j.status === "dead") s.dead++;
    else s.done++;
  }
  return s;
}

/** Latest outbox job for a ride, for per-ride status display. */
export function getOutboxJobForRide(kind: OutboxJobKind, idempotencyKey: string): OutboxJob | null {
  return readOutbox().find((j) => j.id === `${kind}:${idempotencyKey}`) ?? null;
}
