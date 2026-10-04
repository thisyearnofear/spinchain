// @vitest-environment jsdom
// WalletAuthProvider race + queue regression tests.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const wallet = vi.hoisted(() => ({
  address: undefined as string | undefined,
  signMessageAsync: vi.fn() as ReturnType<typeof vi.fn>,
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: wallet.address }),
  useSignMessage: () => ({ signMessageAsync: wallet.signMessageAsync }),
}));

import { WalletAuthProvider, useWalletAuth } from "@/app/hooks/common/use-wallet-auth";

function wrapper({ children }: { children: ReactNode }) {
  return <WalletAuthProvider>{children}</WalletAuthProvider>;
}

function okJson(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

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
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

describe("WalletAuthProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    wallet.address = undefined;
    wallet.signMessageAsync = vi.fn();
  });

  it("clears a pending sign-in when the wallet switches mid-signature", async () => {
    const signing = deferred<string>();
    wallet.signMessageAsync.mockReturnValue(signing.promise);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.includes("/api/auth/me")) return okJson({ session: null });
        if (url.includes("/api/auth/evm-login") && init?.method === "POST") {
          const body = JSON.parse(String(init.body));
          if (!body.signature) {
            return okJson({ nonce: "n1", message: "sign me" });
          }
          return okJson({
            session: { address: body.address, role: "rider", exp: 1 },
          });
        }
        if (url.includes("/api/auth/logout")) return okJson({ ok: true });
        return okJson({});
      });

    wallet.address = A;
    const { result, rerender } = renderHook(() => useWalletAuth(), { wrapper });
    await flush();
    expect(fetchSpy).toHaveBeenCalled();

    let loginPromise!: Promise<void>;
    act(() => {
      loginPromise = result.current.login();
    });
    await waitFor(() => expect(result.current.isAuthenticating).toBe(true));

    // Wallet switches to B while the signature prompt is still open.
    act(() => {
      wallet.address = B;
      rerender();
    });
    signing.resolve("0xsig");
    await act(async () => {
      await loginPromise;
    });

    expect(result.current.isAuthenticating).toBe(false);
    expect(result.current.session).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("a stale login response clears its own cookie before a newer login lands", async () => {
    wallet.signMessageAsync.mockResolvedValue("0xsigA");

    const calls: string[] = [];
    const loginAResponse = deferred<Response>();
    const loginBResponse = deferred<Response>();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/auth/me")) return okJson({ session: null });
      if (url.includes("/api/auth/logout")) {
        calls.push("logout");
        return okJson({ ok: true });
      }
      if (url.includes("/api/auth/evm-login") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        if (!body.signature) return okJson({ nonce: "n", message: "m" });
        calls.push(body.address === A ? "loginA" : "loginB");
        return body.address === A ? loginAResponse.promise : loginBResponse.promise;
      }
      return okJson({});
    });

    wallet.address = A;
    const { result, rerender } = renderHook(() => useWalletAuth(), { wrapper });
    await flush();

    // Start login for A; nonce+signature resolve, so the cookie-mutating POST
    // is in flight inside the serialized queue.
    let loginA!: Promise<void>;
    act(() => {
      loginA = result.current.login();
    });
    await waitFor(() => expect(calls).toContain("loginA"));

    // Wallet switches to B; B signs in — its POST must queue behind A's.
    act(() => {
      wallet.address = B;
      rerender();
    });
    wallet.signMessageAsync.mockResolvedValue("0xsigB");
    let loginB!: Promise<void>;
    act(() => {
      loginB = result.current.login();
    });
    await flush();
    expect(calls).not.toContain("loginB");

    // A's POST resolves stale — it must undo the cookie it just set inside the
    // same queue task before B's mutation is allowed through.
    loginAResponse.resolve(okJson({ session: { address: A, role: "rider", exp: 1 } }));
    await waitFor(() => expect(calls).toEqual(["loginA", "logout", "loginB"]));

    loginBResponse.resolve(okJson({ session: { address: B, role: "rider", exp: 1 } }));
    await act(async () => {
      await Promise.allSettled([loginA, loginB]);
    });
    await flush();
    expect(result.current.session?.address).toBe(B);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("a late /me response cannot restore the previous wallet's session", async () => {
    const meResponse = deferred<Response>();
    let meCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/auth/me")) {
        meCalls++;
        if (meCalls === 1) return meResponse.promise;
        return okJson({ session: { address: B, role: "rider", exp: 1 } });
      }
      return okJson({});
    });

    wallet.address = A;
    const { result, rerender } = renderHook(() => useWalletAuth(), { wrapper });
    await waitFor(() => expect(meCalls).toBe(1));

    // Switch to B while A's /me is still in flight.
    act(() => {
      wallet.address = B;
      rerender();
    });

    // A's stale /me resolves with an A session — fenced off.
    meResponse.resolve(okJson({ session: { address: A, role: "rider", exp: 1 } }));
    await waitFor(() => expect(meCalls).toBe(2));
    await flush();
    expect(result.current.session?.address).toBe(B);
  });

  it("unmounting during a deferred login never POSTs the cookie mutation", async () => {
    const signing = deferred<string>();
    wallet.signMessageAsync.mockReturnValue(signing.promise);
    const posts: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/auth/me")) return okJson({ session: null });
      if (url.includes("/api/auth/evm-login") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        if (!body.signature) return okJson({ nonce: "n", message: "m" });
        posts.push("login");
        return okJson({ session: { address: A, role: "rider", exp: 1 } });
      }
      if (url.includes("/api/auth/logout")) {
        posts.push("logout");
        return okJson({ ok: true });
      }
      return okJson({});
    });

    wallet.address = A;
    const { result, unmount } = renderHook(() => useWalletAuth(), { wrapper });
    await flush();

    let loginPromise!: Promise<void>;
    act(() => {
      loginPromise = result.current.login();
    });
    await waitFor(() => expect(result.current.isAuthenticating).toBe(true));

    unmount();
    signing.resolve("0xsig");
    await loginPromise;
    await flush();

    expect(posts).toHaveLength(0);
  });

  it("explicit logout then sign-in on the same account works", async () => {
    wallet.signMessageAsync.mockResolvedValue("0xsig");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/auth/me")) {
        return okJson({ session: { address: A, role: "rider", exp: 1 } });
      }
      if (url.includes("/api/auth/logout")) return okJson({ ok: true });
      if (url.includes("/api/auth/evm-login") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        if (!body.signature) return okJson({ nonce: "n", message: "m" });
        return okJson({
          session: { address: A, role: "rider", exp: 2 },
        });
      }
      return okJson({});
    });

    wallet.address = A;
    const { result } = renderHook(() => useWalletAuth(), { wrapper });
    await waitFor(() => expect(result.current.session?.address).toBe(A));

    await act(async () => {
      await result.current.logout();
    });
    expect(result.current.session).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isAuthenticating).toBe(false);

    await act(async () => {
      await result.current.login();
    });
    expect(result.current.session?.address).toBe(A);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.error).toBeNull();
  });
});
