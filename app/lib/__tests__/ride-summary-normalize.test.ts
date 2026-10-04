// Shared ride-summary normalizer unit tests.

import { describe, it, expect } from "vitest";
import {
  normalizeSummaryForWrite,
  normalizeSummaryForRead,
} from "@/app/lib/analytics/ride-summary-normalize";

const OWNER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const IDENTITY = { id: "r1", idempotencyKey: "r1:key", riderId: OWNER };

describe("normalizeSummaryForWrite", () => {
  it("keeps whitelisted nested fields and forces canonical identity", () => {
    const res = normalizeSummaryForWrite(
      {
        id: "attacker-id",
        riderId: OWNER,
        spinEarned: 12.5,
        zones: { recovery: 1, endurance: 2, threshold: 3, sprint: 4, bogus: 9 },
        proof: { mode: "zk-batch", status: "claimed", isVerified: true, privacyScore: 0.9, privacyLevel: "high", verifiedScore: 800 },
        settlement: { attempted: true, txHash: "0x" + "ab".repeat(32), status: "confirmed", junk: true },
        anchoring: { attempted: true, status: "confirmed", commitmentEpoch: 7 },
        unknownRootField: "dropped",
      },
      IDENTITY,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const s = res.summary;
    expect(s.id).toBe("r1");
    expect(s.riderId).toBe(OWNER);
    expect(s.idempotencyKey).toBe("r1:key");
    expect(s.spinEarned).toBe(12.5);
    expect(s.zones).toEqual({ recovery: 1, endurance: 2, threshold: 3, sprint: 4 });
    expect((s.proof as Record<string, unknown>).junk).toBeUndefined();
    expect(s.settlement).toEqual({
      attempted: true,
      txHash: "0x" + "ab".repeat(32),
      status: "confirmed",
    });
    expect((s.anchoring as Record<string, unknown>).commitmentEpoch).toBe(7);
    expect(s.unknownRootField).toBeUndefined();
  });

  it("rejects non-object summaries and raw telemetry with 400", () => {
    expect(normalizeSummaryForWrite("nope", IDENTITY).ok).toBe(false);
    expect(normalizeSummaryForWrite([1, 2], IDENTITY).ok).toBe(false);
    const raw = normalizeSummaryForWrite({ heartRateSamples: [1, 2] }, IDENTITY);
    expect(raw.ok).toBe(false);
    if (raw.ok) return;
    expect(raw.status).toBe(400);
  });

  it("rejects a mismatched riderId with 403", () => {
    const res = normalizeSummaryForWrite(
      { riderId: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
      IDENTITY,
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(403);
  });

  it("rejects malformed nested objects with 400", () => {
    for (const key of ["zones", "proof", "settlement", "anchoring"] as const) {
      const res = normalizeSummaryForWrite({ [key]: "not-an-object" }, IDENTITY);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.status).toBe(400);
    }
  });
});

describe("normalizeSummaryForRead", () => {
  it("returns null for non-object or raw-telemetry blobs", () => {
    expect(normalizeSummaryForRead(null)).toBeNull();
    expect(normalizeSummaryForRead("x")).toBeNull();
    expect(normalizeSummaryForRead({ heartRateSamples: [1] })).toBeNull();
  });

  it("whitelists the same fields as the write path", () => {
    const res = normalizeSummaryForRead({
      id: "r1",
      idempotencyKey: "r1:key",
      riderId: OWNER,
      spinEarned: 3,
      telemetrySource: "simulator",
      proof: { mode: "zk-batch", isVerified: true, injected: "dropped" },
    });
    expect(res).not.toBeNull();
    expect(res!.spinEarned).toBe(3);
    expect(res!.telemetrySource).toBe("simulator");
    expect((res!.proof as Record<string, unknown>).injected).toBeUndefined();
  });
});
