// /api/rides roundtrip with mocked session + DB.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const OWNER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const db = vi.hoisted(() => ({
  inserted: [] as Record<string, unknown>[],
  insertError: null as { code?: string; message?: string } | null,
}));

vi.mock("@/app/lib/auth/session", () => ({
  verifySession: vi.fn(async (token: string) =>
    token === "owner-token" ? { address: OWNER, role: "rider", exp: 0 } : null,
  ),
}));

vi.mock("@/app/lib/supabase/client", () => ({
  isSupabaseConfigured: () => true,
  getServerClient: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        db.inserted.push(row);
        return {
          select: () => ({
            single: async () =>
              db.insertError
                ? { data: null, error: db.insertError }
                : { data: row, error: null },
          }),
        };
      },
      select: () => ({
        eq: () => ({
          order: () => ({
            range: async () => ({ data: [], error: null }),
          }),
        }),
      }),
      update: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) }),
      delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    }),
  }),
}));

import { POST, GET } from "@/app/api/rides/route";
import { createRideReceipt } from "@/app/lib/analytics/ride-receipt";
import { createCanonicalRideSummary } from "@/app/lib/analytics/ride-history";

function summaryWith(receiptOverrides?: Record<string, unknown>) {
  const s = createCanonicalRideSummary({
    id: "ride-1",
    riderId: OWNER,
    classId: "class-1",
    className: "Test",
    instructor: "",
    completedAt: 1_700_000_000_000,
    durationSec: 600,
    avgHeartRate: 140,
    avgPower: 180,
    avgEffort: 500,
    spinEarned: 0,
    telemetrySource: "simulator",
    effortTier: "gold",
    zones: { recovery: 0, endurance: 1, threshold: 0, sprint: 0 },
    proof: { mode: "none", status: "idle", isVerified: false, privacyScore: 0, privacyLevel: "high" },
    settlement: { attempted: false, status: "skipped" },
  });
  const receipt = createRideReceipt(s, "ride-1");
  return { ...s, receipt: receiptOverrides ? { ...receipt, ...receiptOverrides } : receipt };
}

function post(body: unknown, token = "owner-token") {
  return POST(new NextRequest(new Request("http://localhost/api/rides", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })));
}

const baseBody = () => ({
  id: "ride-1",
  idempotency_key: "ride-1:key",
  class_id: "class-1",
  completed_at: new Date(1_700_000_000_000).toISOString(),
  elapsed_time: 600,
  avg_effort: 500,
});

describe("POST /api/rides — receipt roundtrip", () => {
  beforeEach(() => {
    db.inserted.length = 0;
    db.insertError = null;
  });

  it("stores a valid receipt canonicalized to the session owner", async () => {
    const summary = summaryWith({
      riderId: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
    const res = await post({ ...baseBody(), summary });
    expect(res.status).toBe(201);
    const stored = db.inserted[0].summary as { receipt?: { riderId: string; provenance: string } };
    expect(stored.receipt?.riderId).toBe(OWNER);
    expect(stored.receipt?.provenance).toBe("simulated");
  });

  it("rejects a receipt bound to a different rider with 403", async () => {
    const summary = summaryWith({ riderId: OTHER });
    const res = await post({ ...baseBody(), summary });
    expect(res.status).toBe(403);
    expect(db.inserted).toHaveLength(0);
  });

  it("rejects receipt id/class/time/duration mismatches with 400", async () => {
    for (const patch of [
      { receiptId: "other-id" },
      { classId: "other-class" },
      { completedAt: 1_700_000_999_999 },
      { durationSec: 999 },
      { provenance: "device-observed" },
    ]) {
      const res = await post({ ...baseBody(), summary: summaryWith(patch) });
      expect(res.status).toBe(400);
    }
    expect(db.inserted).toHaveLength(0);
  });

  it("rejects reserved source-attested provenance", async () => {
    const res = await post({ ...baseBody(), summary: summaryWith({ provenance: "source-attested" }) });
    expect(res.status).toBe(400);
    expect(db.inserted).toHaveLength(0);
  });

  it("GET stays owner-scoped and unauthorized without a session", async () => {
    const anon = await GET(new NextRequest(new Request("http://localhost/api/rides")));
    expect(anon.status).toBe(401);
    const authed = await GET(new NextRequest(new Request("http://localhost/api/rides?limit=10", {
      headers: { authorization: "Bearer owner-token" },
    })));
    expect(authed.status).toBe(200);
  });
});
