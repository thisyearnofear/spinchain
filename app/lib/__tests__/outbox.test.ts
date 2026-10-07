// @vitest-environment jsdom
// Durable outbox: consent holds, backoff, dead letters, crash recovery, single drainer.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  applyConsentToOutbox,
  drainOutbox,
  enqueueOutboxJob,
  getOutboxSummary,
  OUTBOX_LEASE_KEY,
  OUTBOX_MAX_ATTEMPTS,
  OUTBOX_STORAGE_KEY,
  outboxBackoffMs,
  readOutbox,
  retryOutboxJobs,
  type OutboxHandlers,
} from "@/app/lib/sync/outbox";
import { CONSENT_POLICY_VERSION, CONSENT_STORAGE_KEY } from "@/app/lib/privacy/consent";

function grant() {
  localStorage.setItem(
    CONSENT_STORAGE_KEY,
    JSON.stringify({ cloud_history: { granted: true, policyVersion: CONSENT_POLICY_VERSION, updatedAt: 1 } }),
  );
}

const input = { kind: "cloud_history.upsert" as const, idempotencyKey: "k1", rideId: "r1", requiredConsent: "cloud_history" as const };

function handlers(fn: () => Promise<"done" | "skip" | "held_consent">): OutboxHandlers {
  return { "cloud_history.upsert": vi.fn(fn) };
}

describe("outbox", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("holds consent-scoped jobs instead of dropping them, and never runs them", async () => {
    enqueueOutboxJob(input);
    expect(readOutbox()[0].status).toBe("held_consent");
    const h = handlers(async () => "done");
    await drainOutbox(h);
    expect(h["cloud_history.upsert"]).not.toHaveBeenCalled();
    expect(readOutbox()[0].status).toBe("held_consent");
  });

  it("releases held jobs on grant and drains them to done", async () => {
    enqueueOutboxJob(input);
    grant();
    applyConsentToOutbox("cloud_history", true);
    const h = handlers(async () => "done");
    await drainOutbox(h);
    expect(h["cloud_history.upsert"]).toHaveBeenCalledTimes(1);
    expect(readOutbox()[0].status).toBe("done");
  });

  it("a drain alone releases held jobs once consent exists (e.g. granted in another tab)", async () => {
    enqueueOutboxJob(input);
    grant();
    await drainOutbox(handlers(async () => "done"));
    expect(readOutbox()[0].status).toBe("done");
  });

  it("revocation drops not-yet-sent jobs but keeps done history", async () => {
    grant();
    enqueueOutboxJob(input);
    await drainOutbox(handlers(async () => "done"));
    enqueueOutboxJob({ ...input, idempotencyKey: "k2", rideId: "r2" });
    applyConsentToOutbox("cloud_history", false);
    expect(readOutbox().map((j) => j.idempotencyKey)).toEqual(["k1"]);
  });

  it("is idempotent on (kind, idempotencyKey)", () => {
    grant();
    enqueueOutboxJob(input);
    enqueueOutboxJob(input);
    expect(readOutbox()).toHaveLength(1);
  });

  it("survives a reload (state lives in localStorage)", () => {
    grant();
    enqueueOutboxJob(input);
    const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
    localStorage.clear();
    localStorage.setItem(OUTBOX_STORAGE_KEY, raw!);
    expect(readOutbox()[0]).toMatchObject({ idempotencyKey: "k1", status: "queued" });
  });

  it("backs off on failure and does not retry before nextAttemptAt", async () => {
    grant();
    enqueueOutboxJob(input);
    const h = handlers(async () => {
      throw new Error("500");
    });
    await drainOutbox(h);
    const job = readOutbox()[0];
    expect(job).toMatchObject({ status: "failed", attempts: 1, lastError: "500" });
    expect(job.nextAttemptAt).toBeGreaterThan(Date.now() + outboxBackoffMs(1) - 1000);
    await drainOutbox(h);
    expect(h["cloud_history.upsert"]).toHaveBeenCalledTimes(1);
  });

  it("dead-letters after max attempts; manual retry revives", async () => {
    grant();
    enqueueOutboxJob(input);
    const h = handlers(async () => {
      throw new Error("down");
    });
    for (let i = 0; i < OUTBOX_MAX_ATTEMPTS; i++) {
      const jobs = readOutbox().map((j) => ({ ...j, nextAttemptAt: 0 }));
      localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(jobs));
      await drainOutbox(h);
    }
    expect(readOutbox()[0]).toMatchObject({ status: "dead", attempts: OUTBOX_MAX_ATTEMPTS });
    expect(getOutboxSummary().dead).toBe(1);

    retryOutboxJobs();
    expect(readOutbox()[0]).toMatchObject({ status: "queued", attempts: 0 });
    await drainOutbox(handlers(async () => "done"));
    expect(readOutbox()[0].status).toBe("done");
  });

  it("recovers jobs orphaned in_flight by a crash", async () => {
    grant();
    enqueueOutboxJob(input);
    localStorage.setItem(
      OUTBOX_STORAGE_KEY,
      JSON.stringify(readOutbox().map((j) => ({ ...j, status: "in_flight" }))),
    );
    await drainOutbox(handlers(async () => "done"));
    expect(readOutbox()[0].status).toBe("done");
  });

  it("skip removes the job", async () => {
    grant();
    enqueueOutboxJob(input);
    await drainOutbox(handlers(async () => "skip"));
    expect(readOutbox()).toHaveLength(0);
  });

  it("another tab's live lease blocks this drain; an expired one does not", async () => {
    grant();
    enqueueOutboxJob(input);
    localStorage.setItem(OUTBOX_LEASE_KEY, JSON.stringify({ owner: "other-tab", expiresAt: Date.now() + 60_000 }));
    const h = handlers(async () => "done");
    await drainOutbox(h);
    expect(h["cloud_history.upsert"]).not.toHaveBeenCalled();

    localStorage.setItem(OUTBOX_LEASE_KEY, JSON.stringify({ owner: "other-tab", expiresAt: Date.now() - 1 }));
    await drainOutbox(h);
    expect(h["cloud_history.upsert"]).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(OUTBOX_LEASE_KEY)).toBeNull();
  });

  it("concurrent drains in one tab share a single run", async () => {
    grant();
    enqueueOutboxJob(input);
    const h = handlers(async () => "done");
    await Promise.all([drainOutbox(h), drainOutbox(h)]);
    expect(h["cloud_history.upsert"]).toHaveBeenCalledTimes(1);
  });

  it("does nothing offline", async () => {
    grant();
    enqueueOutboxJob(input);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const h = handlers(async () => "done");
    await drainOutbox(h);
    expect(h["cloud_history.upsert"]).not.toHaveBeenCalled();
  });
});
