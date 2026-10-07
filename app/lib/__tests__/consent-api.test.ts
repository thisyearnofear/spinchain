// /api/consent + server-side consent re-check.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const OWNER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const db = vi.hoisted(() => ({
  upserts: [] as Array<{ row: Record<string, unknown>; opts: unknown }>,
  row: null as Record<string, unknown> | null,
  error: null as { message: string } | null,
}));

vi.mock("@/app/lib/auth/session", () => ({
  verifySession: vi.fn(async (token: string) =>
    token === "owner-token" ? { address: OWNER, role: "rider", exp: 0 } : null,
  ),
}));

const client = {
  from: () => ({
    upsert: async (row: Record<string, unknown>, opts: unknown) => {
      db.upserts.push({ row, opts });
      return { error: db.error };
    },
    select: () => ({
      eq: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: db.row, error: db.error }) }),
        then: (resolve: (v: unknown) => void) => resolve({ data: db.row ? [db.row] : [], error: db.error }),
      }),
    }),
  }),
};

vi.mock("@/app/lib/supabase/client", () => ({
  isSupabaseConfigured: () => true,
  getServerClient: () => client,
}));

import { PUT, GET } from "@/app/api/consent/route";
import { hasServerConsent, SERVER_CONSENT_POLICY_VERSION } from "@/app/lib/privacy/consent-server";
import type { SupabaseClient } from "@supabase/supabase-js";

function put(body: unknown, token = "owner-token") {
  return PUT(new NextRequest(new Request("http://localhost/api/consent", {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })));
}

describe("PUT /api/consent", () => {
  beforeEach(() => {
    db.upserts = [];
    db.row = null;
    db.error = null;
  });

  it("401 without a session", async () => {
    const res = await put({ scope: "cloud_history", granted: true, policyVersion: SERVER_CONSENT_POLICY_VERSION }, "bad");
    expect(res.status).toBe(401);
    expect(db.upserts).toHaveLength(0);
  });

  it("rejects unknown scopes and non-boolean grants", async () => {
    expect((await put({ scope: "everything", granted: true })).status).toBe(400);
    expect((await put({ scope: "cloud_history", granted: "yes" })).status).toBe(400);
    expect(db.upserts).toHaveLength(0);
  });

  it("rejects a grant against a stale policy version", async () => {
    const res = await put({ scope: "cloud_history", granted: true, policyVersion: "consent-v0" });
    expect(res.status).toBe(409);
    expect(db.upserts).toHaveLength(0);
  });

  it("upserts one owner-scoped row per scope", async () => {
    const res = await put({ scope: "cloud_history", granted: true, policyVersion: SERVER_CONSENT_POLICY_VERSION });
    expect(res.status).toBe(200);
    expect(db.upserts).toHaveLength(1);
    expect(db.upserts[0].row).toMatchObject({
      address: OWNER,
      scope: "cloud_history",
      granted: true,
      policy_version: SERVER_CONSENT_POLICY_VERSION,
    });
    expect(db.upserts[0].opts).toEqual({ onConflict: "address,scope" });
  });

  it("revocation is accepted regardless of policy version", async () => {
    const res = await put({ scope: "cloud_history", granted: false });
    expect(res.status).toBe(200);
    expect(db.upserts[0].row.granted).toBe(false);
  });

  it("GET is session-gated", async () => {
    const res = await GET(new NextRequest(new Request("http://localhost/api/consent")));
    expect(res.status).toBe(401);
  });
});

describe("hasServerConsent", () => {
  const c = client as unknown as SupabaseClient;
  beforeEach(() => {
    db.row = null;
    db.error = null;
  });

  it("denies when no row exists", async () => {
    expect(await hasServerConsent(c, OWNER, "cloud_history")).toBe(false);
  });

  it("denies revoked, stale-policy, and errored reads", async () => {
    db.row = { granted: false, policy_version: SERVER_CONSENT_POLICY_VERSION };
    expect(await hasServerConsent(c, OWNER, "cloud_history")).toBe(false);
    db.row = { granted: true, policy_version: "consent-v0" };
    expect(await hasServerConsent(c, OWNER, "cloud_history")).toBe(false);
    db.row = { granted: true, policy_version: SERVER_CONSENT_POLICY_VERSION };
    db.error = { message: "relation does not exist" };
    expect(await hasServerConsent(c, OWNER, "cloud_history")).toBe(false);
  });

  it("allows a current grant", async () => {
    db.row = { granted: true, policy_version: SERVER_CONSENT_POLICY_VERSION };
    expect(await hasServerConsent(c, OWNER, "cloud_history")).toBe(true);
  });

  it("public_export denies even with a current grant (global policy)", async () => {
    db.row = { granted: true, policy_version: SERVER_CONSENT_POLICY_VERSION };
    expect(await hasServerConsent(c, OWNER, "public_export")).toBe(false);
  });
});
