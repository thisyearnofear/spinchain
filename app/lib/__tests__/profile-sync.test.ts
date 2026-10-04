// @vitest-environment jsdom
// Profile sync race regression tests.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

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

vi.mock("@/app/lib/walrus/profile-persistence", () => ({
  useProfileSync: () => ({
    syncStatus: "idle",
    setSyncing: vi.fn(),
    setSynced: vi.fn(),
    setFailed: vi.fn(),
    walrusBlobId: null,
  }),
  persistProfileToWalrus: vi.fn(async () => null),
  retrieveProfileFromWalrus: vi.fn(async () => null),
}));

import { useProfileSyncEffect } from "@/app/hooks/common/use-profile-sync";
import { useRiderProfile } from "@/app/stores/rider-profile-store";

function okJson(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function flush() {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

describe("useProfileSyncEffect", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    useRiderProfile.getState().reset();
    wallet.address = undefined;
    wallet.sessionAddress = null;
  });

  it("discards a stale hydration response after a wallet switch", async () => {
    const firstGet = deferred<Response>();
    let gets = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/profile")) {
        gets++;
        return gets === 1 ? firstGet.promise : Promise.resolve(okJson({ profile: null }));
      }
      return Promise.resolve(okJson({}));
    });

    wallet.address = A;
    wallet.sessionAddress = A;
    const { rerender } = renderHook(() => useProfileSyncEffect());
    await waitFor(() => expect(gets).toBe(1));

    // Switch to B before A's response lands.
    wallet.address = B;
    wallet.sessionAddress = B;
    rerender();
    await waitFor(() => expect(gets).toBe(2));

    firstGet.resolve(
      okJson({
        profile: {
          goal: "endurance",
          experience: "advanced",
          frequency: "daily",
          motivation: "data",
        },
      }),
    );
    await flush();

    // A's remote profile must NOT be applied under wallet B.
    expect(useRiderProfile.getState().goal).toBeNull();
    expect(useRiderProfile.getState().isComplete()).toBe(false);
  });

  it("discards a hydration response that lands after unmount", async () => {
    const pending = deferred<Response>();
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/profile")) return pending.promise;
      return Promise.resolve(okJson({}));
    });

    wallet.address = A;
    wallet.sessionAddress = A;
    const { unmount } = renderHook(() => useProfileSyncEffect());
    unmount();

    pending.resolve(
      okJson({
        profile: {
          goal: "endurance",
          experience: "advanced",
          frequency: "daily",
          motivation: "data",
        },
      }),
    );
    await flush();

    expect(useRiderProfile.getState().goal).toBeNull();
  });

  it("never PUTs a leftover complete profile under a different wallet", async () => {
    // A leftover complete local profile (e.g. signed-in under A previously).
    useRiderProfile.getState().setProfile({
      goal: "endurance",
      experience: "advanced",
      frequency: "daily",
      motivation: "data",
    });

    const requests: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      requests.push(`${init?.method ?? "GET"} ${url}`);
      return Promise.resolve(okJson({ profile: null }));
    });

    // Wallet B authenticates while the store still holds the old profile.
    wallet.address = B;
    wallet.sessionAddress = B;
    renderHook(() => useProfileSyncEffect());
    await flush();

    // Advance past the 1s debounce — the PUT must never have been scheduled.
    vi.useFakeTimers();
    vi.advanceTimersByTime(1500);
    vi.useRealTimers();

    expect(requests.filter((r) => r.startsWith("PUT"))).toHaveLength(0);
  });
});
