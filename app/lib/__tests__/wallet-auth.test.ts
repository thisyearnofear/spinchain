// Wallet auth + ride ownership regression tests.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { privateKeyToAccount } from "viem/accounts";

const SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd";
const ACCOUNT = privateKeyToAccount(`0x${"11".repeat(32)}`);
const ACCOUNT2 = privateKeyToAccount(`0x${"22".repeat(32)}`);
const ORIGIN = "http://localhost";

// ---------------------------------------------------------------------------
// In-memory Supabase mock (MOCKED BOUNDARY)
// ---------------------------------------------------------------------------

const db = vi.hoisted(() => {
  const state = {
    nonces: new Map<string, Record<string, unknown>>(),
    rides: new Map<string, Record<string, unknown>>(),
  };

  function nonceTable() {
    let updateVals: Record<string, unknown> | null = null;
    let eqs: [string, unknown][] = [];
    let gts: [string, unknown][] = [];
    const builder: Record<string, unknown> = {
      insert: (row: Record<string, unknown>) => {
        state.nonces.set(row.nonce as string, { ...row, used: false });
        return Promise.resolve({ error: null });
      },
      update: (vals: Record<string, unknown>) => {
        updateVals = vals;
        eqs = [];
        gts = [];
        return builder;
      },
      eq: (c: string, v: unknown) => {
        eqs.push([c, v]);
        return builder;
      },
      gt: (c: string, v: unknown) => {
        gts.push([c, v]);
        return builder;
      },
      select: () => builder,
      maybeSingle: () => {
        const row = [...state.nonces.values()].find(
          (n) =>
            eqs.every(([c, v]) => n[c] === v) &&
            gts.every(([c, v]) => String(n[c]) > String(v)),
        );
        if (row && updateVals) Object.assign(row, updateVals);
        return Promise.resolve({ data: row ?? null, error: null });
      },
    };
    return builder;
  }

  function profilesTable() {
    return {
      upsert: (row: Record<string, unknown>) => ({
        select: () => Promise.resolve({ data: [row], error: null }),
      }),
    };
  }

  function rideRows(eqs: [string, unknown][]) {
    return [...state.rides.values()].filter((r) =>
      eqs.every(([c, v]) => r[c] === v),
    );
  }

  function ridesTable() {
    let vals: Record<string, unknown> | null = null;
    let eqs: [string, unknown][] = [];
    let op: "select" | "update" | "delete" | null = null;
    const builder: Record<string, unknown> = {
      insert: (row: Record<string, unknown>) => {
        const dup = [...state.rides.values()].find(
          (r) =>
            r.id === row.id ||
            (r.idempotency_key && r.idempotency_key === row.idempotency_key),
        );
        if (dup) {
          return {
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: null,
                  error: { code: "23505", message: "duplicate key" },
                }),
            }),
          };
        }
        state.rides.set(row.id as string, { ...row });
        return {
          select: () => ({
            single: () => Promise.resolve({ data: row, error: null }),
          }),
        };
      },
      select: () => {
        // select() follows update()/delete() chains too — don't clobber op.
        if (!op) op = "select";
        return builder;
      },
      update: (v: Record<string, unknown>) => {
        op = "update";
        vals = v;
        eqs = [];
        return builder;
      },
      delete: () => {
        op = "delete";
        eqs = [];
        return builder;
      },
      eq: (c: string, v: unknown) => {
        eqs.push([c, v]);
        return builder;
      },
      order: () => builder,
      range: (from: number, to: number) => {
        const rows = rideRows(eqs).slice(from, to + 1);
        return Promise.resolve({ data: rows, error: null });
      },
      maybeSingle: () => {
        const row = rideRows(eqs)[0] ?? null;
        if (row && op === "update" && vals) Object.assign(row, vals);
        return Promise.resolve({ data: row, error: null });
      },
      then: (resolve: (v: unknown) => void) => {
        if (op === "delete") {
          for (const row of rideRows(eqs)) state.rides.delete(row.id as string);
          resolve({ error: null });
        } else if (op === "select") {
          resolve({ data: rideRows(eqs), error: null });
        } else {
          resolve({ data: null, error: { message: "unsupported op" } });
        }
      },
    };
    return builder;
  }

  const client = {
    from: (table: string) =>
      table === "auth_nonces"
        ? nonceTable()
        : table === "rider_profiles"
          ? profilesTable()
          : ridesTable(),
  };
  return { state, client };
});

vi.mock("@/app/lib/supabase/client", () => ({
  getServerClient: () => db.client,
  isSupabaseConfigured: () => true,
}));

vi.mock("@/app/lib/api/rate-limiter", () => ({
  checkRateLimit: () => ({ allowed: true, retryAfterMs: 0 }),
}));

// ---------------------------------------------------------------------------

type SessionMod = typeof import("@/app/lib/auth/session");
let session: SessionMod;
let evmLogin: typeof import("@/app/api/auth/evm-login/route");
let suiLogin: typeof import("@/app/api/auth/sui-login/route");
let meRoute: typeof import("@/app/api/auth/me/route");
let ridesRoute: typeof import("@/app/api/rides/route");

function post(url: string, body: unknown, cookie?: string) {
  return new NextRequest(new URL(url, ORIGIN), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function get(url: string, cookie?: string) {
  return new NextRequest(new URL(url, ORIGIN), {
    headers: cookie ? { cookie } : {},
  });
}

beforeAll(async () => {
  vi.stubEnv("SESSION_SECRET", SECRET);
  vi.resetModules();
  session = await import("@/app/lib/auth/session");
  evmLogin = await import("@/app/api/auth/evm-login/route");
  suiLogin = await import("@/app/api/auth/sui-login/route");
  meRoute = await import("@/app/api/auth/me/route");
  ridesRoute = await import("@/app/api/rides/route");
});

beforeEach(() => {
  db.state.nonces.clear();
  db.state.rides.clear();
});

// ---------------------------------------------------------------------------

describe("session tokens", () => {
  const addr = ACCOUNT.address.toLowerCase();

  it("mints a signed token that verifies back to the payload", async () => {
    const token = await session.createSession(addr, "rider");
    expect(token).toBeTruthy();
    expect(token!.split(".")).toHaveLength(2);
    const payload = await session.verifySession(token!);
    expect(payload?.address).toBe(addr);
    expect(payload?.role).toBe("rider");
    expect(payload!.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects tampered, malformed, unsigned, and expired tokens", async () => {
    const token = await session.createSession(addr, "rider");
    expect(await session.verifySession(token! + "ff")).toBeNull();
    expect(await session.verifySession("not-a-token")).toBeNull();
    expect(await session.verifySession("")).toBeNull();

    // Expired but validly-signed payload.
    const payloadB64 = btoa(
      JSON.stringify({ address: addr, role: "rider", exp: 1 }),
    );
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(payloadB64),
    );
    const sigHex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(await session.verifySession(`${payloadB64}.${sigHex}`)).toBeNull();
  });

  it("rejects bad roles and malformed addresses inside a validly-signed token", async () => {
    for (const bad of [
      { address: addr, role: "admin", exp: 9e15 },
      { address: "not-an-address", role: "rider", exp: 9e15 },
    ]) {
      const payloadB64 = btoa(JSON.stringify(bad));
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const sig = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(payloadB64),
      );
      const sigHex = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      expect(await session.verifySession(`${payloadB64}.${sigHex}`)).toBeNull();
    }
  });

  it("fails closed when SESSION_SECRET is missing or too short", async () => {
    vi.stubEnv("SESSION_SECRET", "short");
    vi.resetModules();
    const weak = await import("@/app/lib/auth/session");
    expect(weak.isAuthConfigured()).toBe(false);
    expect(await weak.createSession(addr, "rider")).toBeNull();
    const token = await session.createSession(addr, "rider");
    expect(await weak.verifySession(token!)).toBeNull();
    // restore strong secret for the rest of the suite
    vi.stubEnv("SESSION_SECRET", SECRET);
    vi.resetModules();
    session = await import("@/app/lib/auth/session");
  });
});

// ---------------------------------------------------------------------------

describe("EVM login + rides ownership (mocked Supabase)", () => {
  async function login(account: typeof ACCOUNT) {
    const step1 = await evmLogin.POST(
      post("/api/auth/evm-login", { address: account.address }),
    );
    expect(step1.status).toBe(200);
    const { nonce, message } = await step1.json();
    const signature = await account.signMessage({ message });
    const step2 = await evmLogin.POST(
      post("/api/auth/evm-login", {
        address: account.address,
        nonce,
        signature,
      }),
    );
    expect(step2.status).toBe(200);
    const body = await step2.json();
    expect(body.session.address).toBe(account.address.toLowerCase());
    const cookie = step2.cookies.get("spinchain-session");
    expect(cookie?.value).toBeTruthy();
    return { nonce, cookie: `spinchain-session=${cookie!.value}` };
  }

  it("full flow: nonce → sign → cookie → /me → ride POST → scoped GET", async () => {
    const { cookie } = await login(ACCOUNT);

    const me = await meRoute.GET(get("/api/auth/me", cookie));
    const meBody = await me.json();
    expect(meBody.session?.address).toBe(ACCOUNT.address.toLowerCase());

    const saved = await ridesRoute.POST(
      post(
        "/api/rides",
        {
          id: "ride-1",
          idempotency_key: "ride-1:key",
          elapsed_time: 1200,
          avg_effort: 400,
          summary: {
            id: "ride-1",
            spinEarned: 12.5,
            proof: { mode: "zk-batch", status: "claimed", isVerified: true },
          },
        },
        cookie,
      ),
    );
    expect(saved.status).toBe(201);

    const list = await ridesRoute.GET(get("/api/rides?limit=50&offset=0", cookie));
    const { rides } = await list.json();
    expect(rides).toHaveLength(1);
    expect(rides[0].rider_address).toBe(ACCOUNT.address.toLowerCase());
    expect(rides[0].summary.spinEarned).toBe(12.5);
    // Identity fields forced server-side, never from client summary.
    expect(rides[0].summary.riderId).toBe(ACCOUNT.address.toLowerCase());
  });

  it("rejects invalid address, bad signature (nonce survives), and replay", async () => {
    const bad = await evmLogin.POST(
      post("/api/auth/evm-login", { address: "0x123" }),
    );
    expect(bad.status).toBe(400);

    const step1 = await evmLogin.POST(
      post("/api/auth/evm-login", { address: ACCOUNT.address }),
    );
    const { nonce, message } = await step1.json();

    // Wrong message signed → 403, and the nonce must NOT be consumed.
    const wrongSig = await ACCOUNT.signMessage({ message: "different" });
    const badLogin = await evmLogin.POST(
      post("/api/auth/evm-login", {
        address: ACCOUNT.address,
        nonce,
        signature: wrongSig,
      }),
    );
    expect(badLogin.status).toBe(403);
    expect(db.state.nonces.get(nonce)?.used).toBe(false);

    // Real signature → 200; replay → 403.
    const signature = await ACCOUNT.signMessage({ message });
    const ok = await evmLogin.POST(
      post("/api/auth/evm-login", {
        address: ACCOUNT.address,
        nonce,
        signature,
      }),
    );
    expect(ok.status).toBe(200);
    const replay = await evmLogin.POST(
      post("/api/auth/evm-login", {
        address: ACCOUNT.address,
        nonce,
        signature,
      }),
    );
    expect(replay.status).toBe(403);
  });

  it("same-owner retry updates; cross-owner id/key conflict is 403 and never rewrites", async () => {
    const a = await login(ACCOUNT);
    const b = await login(ACCOUNT2);

    const rideBody = {
      id: "ride-shared",
      idempotency_key: "ride-shared:key",
      elapsed_time: 600,
      avg_effort: 300,
    };
    expect(
      (await ridesRoute.POST(post("/api/rides", rideBody, a.cookie))).status,
    ).toBe(201);

    // Same owner, same identity → mutable fields update.
    const retry = await ridesRoute.POST(
      post("/api/rides", { ...rideBody, avg_effort: 450 }, a.cookie),
    );
    expect(retry.status).toBe(200);
    expect(db.state.rides.get("ride-shared")?.avg_effort).toBe(450);
    expect(db.state.rides.get("ride-shared")?.rider_address).toBe(
      ACCOUNT.address.toLowerCase(),
    );

    // Different owner, same id/key → 403; record untouched.
    const steal = await ridesRoute.POST(
      post("/api/rides", { ...rideBody, avg_effort: 999 }, b.cookie),
    );
    expect(steal.status).toBe(403);
    expect(db.state.rides.get("ride-shared")?.avg_effort).toBe(450);
    expect(db.state.rides.get("ride-shared")?.rider_address).toBe(
      ACCOUNT.address.toLowerCase(),
    );

    // DELETE is owner-scoped too.
    const delOther = await ridesRoute.DELETE(
      get("/api/rides?id=ride-shared", b.cookie),
    );
    expect(delOther.status).toBe(200);
    expect(db.state.rides.has("ride-shared")).toBe(true);
  });

  it("rejects summary objects containing raw heart-rate arrays with 400", async () => {
    const { cookie } = await login(ACCOUNT);
    const res = await ridesRoute.POST(
      post(
        "/api/rides",
        {
          id: "ride-hr",
          idempotency_key: "ride-hr:key",
          elapsed_time: 60,
          avg_effort: 100,
          summary: { heartRateSamples: [150, 151, 152] },
        },
        cookie,
      ),
    );
    expect(res.status).toBe(400);
    // Invalid summaries are rejected before any insert — nothing persisted.
    expect(db.state.rides.has("ride-hr")).toBe(false);
  });

  it("strips raw heart-rate arrays nested inside summary.proof", async () => {
    const { cookie } = await login(ACCOUNT);
    const res = await ridesRoute.POST(
      post(
        "/api/rides",
        {
          id: "ride-nested-hr",
          idempotency_key: "ride-nested-hr:key",
          elapsed_time: 60,
          avg_effort: 100,
          summary: {
            id: "ride-nested-hr",
            spinEarned: 5,
            proof: {
              mode: "zk-batch",
              status: "claimed",
              isVerified: true,
              heartRateSamples: [150, 151, 152],
              secretField: "nope",
            },
          },
        },
        cookie,
      ),
    );
    expect(res.status).toBe(201);
    const row = db.state.rides.get("ride-nested-hr");
    const proof = (row?.summary as Record<string, unknown>)?.proof as Record<
      string,
      unknown
    >;
    expect(proof.mode).toBe("zk-batch");
    expect(proof.isVerified).toBe(true);
    // Nested whitelist: unknown/raw fields are dropped, not persisted.
    expect(proof.heartRateSamples).toBeUndefined();
    expect(proof.secretField).toBeUndefined();
  });

  it("rejects a summary.riderId that does not match the session owner (403, no write)", async () => {
    const { cookie } = await login(ACCOUNT);
    const res = await ridesRoute.POST(
      post(
        "/api/rides",
        {
          id: "ride-wrong-owner",
          idempotency_key: "ride-wrong-owner:key",
          elapsed_time: 60,
          avg_effort: 100,
          summary: { riderId: ACCOUNT2.address.toLowerCase() },
        },
        cookie,
      ),
    );
    expect(res.status).toBe(403);
    expect(db.state.rides.has("ride-wrong-owner")).toBe(false);
  });

  it("rejects malformed nested summary fields with 400", async () => {
    const { cookie } = await login(ACCOUNT);
    const res = await ridesRoute.POST(
      post(
        "/api/rides",
        {
          id: "ride-bad-zones",
          idempotency_key: "ride-bad-zones:key",
          elapsed_time: 60,
          avg_effort: 100,
          summary: { zones: "not-an-object" },
        },
        cookie,
      ),
    );
    expect(res.status).toBe(400);
    expect(db.state.rides.has("ride-bad-zones")).toBe(false);
  });

  it("unauthenticated ride access is rejected", async () => {
    expect((await ridesRoute.GET(get("/api/rides"))).status).toBe(401);
    expect(
      (
        await ridesRoute.POST(
          post("/api/rides", { id: "x", idempotency_key: "k" }),
        )
      ).status,
    ).toBe(401);
  });
});

describe("Sui login ordering (mocked Supabase)", () => {
  const suiAddress = `0x${"11".repeat(32)}`;

  it("an invalid signature returns 403 without consuming the nonce", async () => {
    const step1 = await suiLogin.POST(
      post("/api/auth/sui-login", { address: suiAddress }),
    );
    expect(step1.status).toBe(200);
    const { nonce } = await step1.json();

    const res = await suiLogin.POST(
      post("/api/auth/sui-login", {
        address: suiAddress,
        nonce,
        signature: "AA==",
      }),
    );
    expect(res.status).toBe(403);
    expect(db.state.nonces.get(nonce)?.used).toBe(false);
  });

  it("returns 400 for a null or non-object JSON body", async () => {
    for (const raw of ["null", "42", '"text"', "[]"]) {
      const res = await suiLogin.POST(
        new NextRequest("http://localhost/api/auth/sui-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: raw,
        }),
      );
      expect(res.status, raw).toBe(400);
    }
  });
});
