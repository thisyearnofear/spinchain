// @vitest-environment jsdom
// Cloud identity + hydration race regression tests.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const GUEST = "guest-1234";

const wallet = vi.hoisted(() => ({
  address: undefined as string | undefined,
  sessionAddress: null as string | null,
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: wallet.address }),
}));

vi.mock("@/app/hooks/common/use-wallet-auth", () => ({
  useWalletAuth: () => ({
    session: wallet.sessionAddress
      ? { address: wallet.sessionAddress, role: "rider", exp: 0 }
      : null,
    isAuthenticated: !!wallet.sessionAddress,
    isAuthenticating: false,
    error: null,
    login: async () => {},
    logout: async () => {},
  }),
}));

vi.mock("@/app/lib/supabase/client", () => ({
  isSupabaseConfigured: () => true,
}));

import {
  saveRideToSupabase,
  useSupabaseSync,
  RIDE_HISTORY_UPDATED_EVENT,
} from "@/app/hooks/common/use-supabase-sync";
import {
  createCanonicalRideSummary,
  getRideHistory,
  STORAGE_KEYS,
} from "@/app/lib/analytics/ride-history";
import { createRideReceipt } from "@/app/lib/analytics/ride-receipt";
import type { RideSummary } from "@/app/lib/analytics/ride-history";
import { CONSENT_POLICY_VERSION, CONSENT_STORAGE_KEY } from "@/app/lib/privacy/consent";

function grantCloudHistory() {
  localStorage.setItem(
    CONSENT_STORAGE_KEY,
    JSON.stringify({ cloud_history: { granted: true, policyVersion: CONSENT_POLICY_VERSION, updatedAt: 1 } }),
  );
}

function ride(riderId: string, id = `ride-${Math.random().toString(36).slice(2)}`): RideSummary {
  return createCanonicalRideSummary({
    id,
    riderId,
    classId: "class",
    className: "Test",
    instructor: "",
    completedAt: Date.now(),
    durationSec: 600,
    avgHeartRate: 150,
    avgPower: 200,
    avgEffort: 400,
    spinEarned: 0,
    telemetrySource: "live-bike",
    effortTier: "bronze",
    zones: { recovery: 0, endurance: 0, threshold: 0, sprint: 0 },
    proof: { mode: "none", status: "idle", isVerified: false, privacyScore: 0, privacyLevel: "high" },
  });
}

function okJson(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("saveRideToSupabase identity gate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    grantCloudHistory();
  });

  it("never calls fetch without cloud_history consent, even for a matching owner", async () => {
    localStorage.clear();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okJson({ session: { address: A } }));
    expect(await saveRideToSupabase(ride(A))).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never calls fetch for guest or malformed rider ids", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await saveRideToSupabase(ride(GUEST))).toBe(false);
    expect(await saveRideToSupabase(ride("not-an-address"))).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not POST a ride owned by a different wallet than the session", async () => {
    const urls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      urls.push(String(input));
      // Cookie belongs to A; the ride belongs to B.
      return okJson({ session: { address: A } });
    });
    expect(await saveRideToSupabase(ride(B))).toBe(false);
    expect(urls.some((u) => u.includes("/api/auth/me"))).toBe(true);
    expect(urls.some((u) => u.includes("/api/rides"))).toBe(false);
  });

  it("returns false when /api/auth/me fails even for a matching owner", async () => {
    const urls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      urls.push(String(input));
      return new Response("unauthorized", { status: 401 });
    });
    expect(await saveRideToSupabase(ride(A))).toBe(false);
    expect(urls.some((u) => u.includes("/api/rides"))).toBe(false);

    urls.length = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      urls.push(String(input));
      return new Response("boom", { status: 500 });
    });
    expect(await saveRideToSupabase(ride(A))).toBe(false);
    expect(urls.some((u) => u.includes("/api/rides"))).toBe(false);
  });

  it("POSTs only for a matching owner and reports response.ok", async () => {
    const urls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/api/auth/me")) return okJson({ session: { address: A } });
      return okJson({ id: "x" });
    });
    expect(await saveRideToSupabase(ride(A))).toBe(true);
    expect(urls.some((u) => u.includes("/api/rides"))).toBe(true);

    urls.length = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("/api/auth/me")) return okJson({ session: { address: A } });
      return new Response("db down", { status: 500 });
    });
    expect(await saveRideToSupabase(ride(A))).toBe(false);
  });
});

describe("useSupabaseSync hydration fencing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    grantCloudHistory();
    wallet.address = undefined;
    wallet.sessionAddress = null;
  });

  function deferred<T>() {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  async function flush() {
    // Let pending fetch/json/dynamic-import microtasks and timers settle.
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
  }

  it("ignores a delayed A response after switching to B", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    let rideFetches = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/api/rides")) {
        rideFetches++;
        return rideFetches === 1 ? first.promise : second.promise;
      }
      return Promise.resolve(okJson({}));
    });
    const eventSpy = vi.fn();
    window.addEventListener(RIDE_HISTORY_UPDATED_EVENT, eventSpy);

    wallet.address = A;
    wallet.sessionAddress = A;
    const { rerender } = renderHook(() => useSupabaseSync());

    // Switch to B before A's response lands.
    wallet.address = B;
    wallet.sessionAddress = B;
    rerender();
    await waitFor(() => expect(rideFetches).toBe(2));

    // Now A's stale response resolves — must be discarded by the fence.
    first.resolve(
      okJson({ rides: [{ id: "a-ride", idempotency_key: "a:key", rider_address: A }] }),
    );
    second.resolve(okJson({ rides: [] }));
    await flush();

    const stored = localStorage.getItem(STORAGE_KEYS.rideHistory);
    const parsed: RideSummary[] = stored ? JSON.parse(stored) : [];
    expect(parsed.find((r) => r.id === "a-ride")).toBeUndefined();
    expect(eventSpy).not.toHaveBeenCalled();
    window.removeEventListener(RIDE_HISTORY_UPDATED_EVENT, eventSpy);
  });

  it("A→B→A gets a fresh generation — the first A response cannot merge", async () => {
    const firstA = deferred<Response>();
    const laterA = deferred<Response>();
    let rideFetches = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (!url.startsWith("/api/rides")) return Promise.resolve(okJson({}));
      rideFetches++;
      return rideFetches === 1 ? firstA.promise : laterA.promise;
    });

    wallet.address = A;
    wallet.sessionAddress = A;
    const { rerender } = renderHook(() => useSupabaseSync());

    wallet.address = B;
    wallet.sessionAddress = B;
    rerender();
    wallet.address = A;
    wallet.sessionAddress = A;
    rerender();
    await waitFor(() => expect(rideFetches).toBe(3));

    firstA.resolve(
      okJson({ rides: [{ id: "stale-a", idempotency_key: "stale:key", rider_address: A }] }),
    );
    laterA.resolve(okJson({ rides: [] }));
    await flush();

    const stored = localStorage.getItem(STORAGE_KEYS.rideHistory);
    const parsed: RideSummary[] = stored ? JSON.parse(stored) : [];
    expect(parsed.find((r) => r.id === "stale-a")).toBeUndefined();
  });

  it("retries hydration after a 401 once a session exists", async () => {
    let calls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/api/rides")) {
        calls++;
        return Promise.resolve(
          calls === 1 ? new Response("nope", { status: 401 }) : okJson({ rides: [] }),
        );
      }
      if (url.includes("/api/auth/me")) {
        return Promise.resolve(okJson({ session: { address: wallet.sessionAddress } }));
      }
      return Promise.resolve(okJson({}));
    });

    // Connected wallet but no session → hydration never runs.
    wallet.address = A;
    wallet.sessionAddress = null;
    const { rerender } = renderHook(() => useSupabaseSync());
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toBe(0);

    // Sign in → hydration runs and gets 401 (must NOT mark complete).
    wallet.sessionAddress = A;
    rerender();
    await waitFor(() => expect(calls).toBe(1));

    // Sign out and back in → the address is fetched again, not skipped.
    wallet.sessionAddress = null;
    rerender();
    wallet.sessionAddress = A;
    rerender();
    await waitFor(() => expect(calls).toBe(2));
  });

  it("unmounting mid-response never merges or notifies", async () => {
    const pending = deferred<Response>();
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/api/rides")) return pending.promise;
      return Promise.resolve(okJson({}));
    });
    const eventSpy = vi.fn();
    window.addEventListener(RIDE_HISTORY_UPDATED_EVENT, eventSpy);

    wallet.address = A;
    wallet.sessionAddress = A;
    const { unmount } = renderHook(() => useSupabaseSync());
    unmount();

    pending.resolve(
      okJson({ rides: [{ id: "late", idempotency_key: "late:key", rider_address: A }] }),
    );
    await flush();

    const stored = localStorage.getItem(STORAGE_KEYS.rideHistory);
    const parsed: RideSummary[] = stored ? JSON.parse(stored) : [];
    expect(parsed.find((r) => r.id === "late")).toBeUndefined();
    expect(eventSpy).not.toHaveBeenCalled();
    window.removeEventListener(RIDE_HISTORY_UPDATED_EVENT, eventSpy);
  });

  it("hydrates a canonical summary with its receipt intact into empty history", async () => {
    const summary = ride(A, "cloud-ride-1");
    summary.receipt = createRideReceipt(summary, "cloud-ride-1");
    const checksumReceipt = {
      ...summary.receipt,
      riderId: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    };
    // Checksum-cased receipt riderId must be canonicalized, not dropped.
    const row = {
      id: "cloud-ride-1",
      idempotency_key: summary.idempotencyKey,
      rider_address: A,
      class_id: "class",
      class_name: "Test",
      instructor: "",
      completed_at: new Date(summary.completedAt).toISOString(),
      elapsed_time: 600,
      avg_effort: 400,
      summary: { ...summary, receipt: checksumReceipt },
    };

    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/api/rides")) {
        return Promise.resolve(okJson({ rides: [row] }));
      }
      return Promise.resolve(okJson({}));
    });

    wallet.address = A;
    wallet.sessionAddress = A;
    renderHook(() => useSupabaseSync());
    await waitFor(() =>
      expect(localStorage.getItem(STORAGE_KEYS.rideHistory)).toContain("cloud-ride-1"),
    );

    const loaded = getRideHistory().find((r) => r.id === "cloud-ride-1");
    expect(loaded).toBeTruthy();
    expect(loaded?.receipt?.receiptId).toBe("cloud-ride-1");
    expect(loaded?.receipt?.riderId).toBe(A);
    expect(loaded?.receipt?.verification).toEqual({ status: "unverified", issuer: null });
    expect(loaded?.receipt?.provenance).toBe("device-observed");
  });

  it("retries every owned ride regardless of relay status, never guests", async () => {
    const ownedAnchored = ride(A, "owned-anchored");
    ownedAnchored.sync = { status: "anchored", retryCount: 0 };
    const ownedIdle = ride(A, "owned-idle");
    const guest = ride(GUEST, "guest-ride");
    const other = ride(B, "other-wallet");
    localStorage.setItem(
      STORAGE_KEYS.rideHistory,
      JSON.stringify([ownedAnchored, ownedIdle, guest, other]),
    );

    const posts: Record<string, unknown>[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url.startsWith("/api/rides") && init?.method === "POST") {
        posts.push(JSON.parse(String(init.body)));
        return Promise.resolve(okJson({ id: "ok" }));
      }
      if (url.startsWith("/api/rides")) return Promise.resolve(okJson({ rides: [] }));
      if (url.includes("/api/auth/me")) {
        return Promise.resolve(okJson({ session: { address: A } }));
      }
      return Promise.resolve(okJson({}));
    });

    wallet.address = A;
    wallet.sessionAddress = A;
    renderHook(() => useSupabaseSync());

    await waitFor(() => expect(posts.length).toBe(2));
    const ids = posts.map((p) => p.id);
    expect(ids.sort()).toEqual(["owned-anchored", "owned-idle"]);
  });

  it("neither hydrates nor backfills without cloud_history consent", async () => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.rideHistory, JSON.stringify([ride(A, "owned")]));
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okJson({ rides: [] }));
    wallet.address = A;
    wallet.sessionAddress = A;
    renderHook(() => useSupabaseSync());
    await flush();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
