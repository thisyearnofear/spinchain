// RideReceiptV1 + policy unit tests.

import { describe, it, expect } from "vitest";
import {
  createRideReceipt,
  parseRideReceipt,
  type RideReceiptV1,
} from "@/app/lib/analytics/ride-receipt";
import {
  createCanonicalRideSummary,
  type RideSummary,
} from "@/app/lib/analytics/ride-history";
import { isPersonalDataPublicationAllowed } from "@/app/lib/privacy/publication-policy";
import { isLegacyRewardClaimsEnabled } from "@/app/lib/rewards/legacy-policy";
import {
  normalizeSummaryForWrite,
  normalizeSummaryForRead,
} from "@/app/lib/analytics/ride-summary-normalize";

const OWNER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function baseSummary(
  overrides: Partial<RideSummary> = {},
): RideSummary {
  return createCanonicalRideSummary({
    id: "sess-1",
    riderId: OWNER,
    classId: "class-1",
    className: "Demo",
    instructor: "Coach",
    completedAt: 1_700_000_000_000,
    durationSec: 2700,
    avgHeartRate: 140,
    avgPower: 180,
    avgEffort: 650,
    spinEarned: 0,
    telemetrySource: "simulator",
    effortTier: "gold",
    zones: { recovery: 0, endurance: 1, threshold: 0, sprint: 0 },
    proof: {
      mode: "none",
      status: "idle",
      isVerified: false,
      privacyScore: 0,
      privacyLevel: "high",
    },
    settlement: { attempted: false, status: "skipped" },
    ...overrides,
  });
}

describe("createRideReceipt", () => {
  it("maps every telemetrySource to the right provenance", () => {
    expect(
      createRideReceipt(baseSummary({ telemetrySource: "simulator" }), "sess-1").provenance,
    ).toBe("simulated");
    expect(
      createRideReceipt(baseSummary({ telemetrySource: "live-bike" }), "sess-1").provenance,
    ).toBe("device-observed");
    expect(
      createRideReceipt(baseSummary({ telemetrySource: "estimated" }), "sess-1").provenance,
    ).toBe("estimated");
  });

  it("is deterministic for the same inputs and binds receiptId to summary.id", () => {
    const s = baseSummary();
    const a = createRideReceipt(s, "sess-1");
    const b = createRideReceipt(s, "sess-1");
    expect(a).toEqual(b);
    expect(a.receiptId).toBe(s.id);
    expect(a.sessionId).toBe("sess-1");
    expect(a.riderId).toBe(OWNER);
    expect(a.classId).toBe("class-1");
    expect(a.completedAt).toBe(s.completedAt);
    expect(a.durationSec).toBe(s.durationSec);
  });

  it("supports a guest riderId and rejects an empty sessionId", () => {
    expect(createRideReceipt(baseSummary({ riderId: "guest" }), "s").riderId).toBe("guest");
    expect(() => createRideReceipt(baseSummary(), "")).toThrow();
  });

  it("carries no raw samples, financial amounts, or proof fields", () => {
    const receipt = createRideReceipt(
      baseSummary({ spinEarned: 42 }),
      "sess-1",
    ) as unknown as Record<string, unknown>;
    expect(receipt.spinEarned).toBeUndefined();
    expect(receipt.proof).toBeUndefined();
    expect(receipt.txHash).toBeUndefined();
    expect(receipt.samples).toBeUndefined();
    expect(receipt.verification).toEqual({ status: "unverified", issuer: null });
    expect(receipt.redemption).toEqual({
      status: "unavailable",
      reason: "redemption-not-enabled",
    });
    expect(receipt.telemetryCommitment).toBeNull();
  });
});

describe("parseRideReceipt", () => {
  const rebuild = () => createRideReceipt(baseSummary(), "sess-1");

  it("round-trips a valid receipt through JSON", () => {
    const parsed = parseRideReceipt(JSON.parse(JSON.stringify(rebuild())));
    expect(parsed).toEqual(rebuild());
  });

  it("strips unknown extra fields on read", () => {
    const parsed = parseRideReceipt({ ...rebuild(), nickname: "spicy", rank: 3 });
    expect(parsed).not.toBeNull();
    expect((parsed as unknown as Record<string, unknown>).nickname).toBeUndefined();
  });

  it("rejects reserved/forged upgrades and raw sample arrays", () => {
    const v = rebuild();
    for (const mutated of [
      { ...v, provenance: "source-attested" },
      { ...v, verification: { status: "verified", issuer: "spinchain" } },
      { ...v, redemption: { status: "claimable", reason: "redemption-not-enabled" } },
      { ...v, redemption: { status: "unavailable", reason: "redemption-not-enabled" }, txHash: "0xabc" },
      { ...v, proofHash: "0x1234" },
      { ...v, claimable: true },
      { ...v, spinEarned: 5 },
      { ...v, heartRateSamples: [1, 2, 3] },
      { ...v, samples: [] },
    ]) {
      expect(parseRideReceipt(mutated)).toBeNull();
    }
  });

  it("rejects non-finite/negative numbers, empty ids, wrong version/policy", () => {
    const v = rebuild();
    for (const mutated of [
      { ...v, version: 2 },
      { ...v, policyVersion: "ride-record-v2" },
      { ...v, receiptId: "" },
      { ...v, sessionId: "" },
      { ...v, riderId: "" },
      { ...v, classId: "" },
      { ...v, completedAt: Number.NaN },
      { ...v, completedAt: -5 },
      { ...v, durationSec: Infinity },
      { ...v, telemetryCommitment: "0xdead" },
      { ...v, progression: { rideRecorded: false } },
      null,
      "receipt",
      [1, 2],
    ]) {
      expect(parseRideReceipt(mutated)).toBeNull();
    }
  });
});

describe("publication + legacy policies", () => {
  it("personal-data publication is hard-denied — no env override exists", () => {
    expect(isPersonalDataPublicationAllowed()).toBe(false);
    expect(isPersonalDataPublicationAllowed.length).toBe(0);
  });

  it("legacy reward claims are off by default", () => {
    delete process.env.NEXT_PUBLIC_ENABLE_LEGACY_REWARD_CLAIMS;
    expect(isLegacyRewardClaimsEnabled()).toBe(false);
  });
});

describe("normalizeSummaryForWrite receipt handling", () => {
  const identity = { id: "sess-1", idempotencyKey: "sess-1:key", riderId: OWNER };

  it("preserves a valid receipt that matches the canonical row", () => {
    const summary = baseSummary();
    summary.receipt = createRideReceipt(summary, "sess-1");
    const res = normalizeSummaryForWrite(summary, identity);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect((res.summary.receipt as RideReceiptV1 | undefined)?.receiptId).toBe("sess-1");
  });

  it("accepts legacy summaries with no receipt", () => {
    const res = normalizeSummaryForWrite(baseSummary(), identity);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.summary.receipt).toBeUndefined();
  });

  it("rejects a malformed receipt", () => {
    const summary = baseSummary();
    (summary as unknown as Record<string, unknown>).receipt = { version: 9 };
    const res = normalizeSummaryForWrite(summary, identity);
    expect(res.ok).toBe(false);
  });

  it("rejects a receipt bound to a different rider or identity", () => {
    const summary = baseSummary();
    const other = baseSummary({ riderId: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" });
    summary.receipt = createRideReceipt(other, "sess-1");
    expect(normalizeSummaryForWrite(summary, identity).ok).toBe(false);

    const s2 = baseSummary();
    const r = createRideReceipt(s2, "sess-1");
    s2.receipt = { ...r, receiptId: "different-id" };
    expect(normalizeSummaryForWrite(s2, identity).ok).toBe(false);

    const s3 = baseSummary();
    s3.receipt = { ...createRideReceipt(s3, "sess-1"), durationSec: 999 };
    expect(normalizeSummaryForWrite(s3, identity).ok).toBe(false);
  });
});

describe("normalizeSummaryForRead receipt handling", () => {
  it("keeps a receipt that matches the stored row and drops mismatches", () => {
    const summary = baseSummary();
    summary.receipt = createRideReceipt(summary, "sess-1");
    const okRead = normalizeSummaryForRead(summary);
    expect((okRead?.receipt as RideReceiptV1 | undefined)?.receiptId).toBe("sess-1");

    const mismatched = {
      ...summary,
      receipt: { ...summary.receipt, riderId: "0xcccccccccccccccccccccccccccccccccccccccc" },
    };
    const badRead = normalizeSummaryForRead(mismatched);
    expect(badRead?.receipt).toBeUndefined();
  });
});
