"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAccount, useSignMessage } from "wagmi";
import type { SessionPayload } from "@/app/lib/auth/types";

interface WalletAuthContextValue {
  session: SessionPayload | null;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const WalletAuthContext = createContext<WalletAuthContextValue | null>(null);

export function WalletAuthProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generation fence: bumped on address change and explicit login.
  const generationRef = useRef(0);
  const isCurrent = useCallback(
    (generation: number) => generation === generationRef.current,
    [],
  );

  // Invalidate in-flight generations on unmount.
  useEffect(
    () => () => {
      generationRef.current += 1;
    },
    [],
  );

  // Mirrors readable inside async work without adding deps.
  const sessionRef = useRef<SessionPayload | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  const addressRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    addressRef.current = address;
  }, [address]);

  // Cookie-mutating requests are serialized so they cannot interleave.
  const cookieQueue = useRef<Promise<unknown>>(Promise.resolve());
  const runCookieMutation = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const p = cookieQueue.current.then(fn);
    cookieQueue.current = p.then(
      () => undefined,
      () => undefined,
    );
    return p;
  }, []);

  const serverLogout = useCallback(
    () =>
      fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      }),
    [],
  );

  const logout = useCallback(async () => {
    generationRef.current += 1;
    setSession(null);
    setIsAuthenticating(false);
    setError(null);
    try {
      await runCookieMutation(() => serverLogout());
    } catch {
      // Cookie clear is best-effort.
    }
  }, [runCookieMutation, serverLogout]);

  // Initial /me fetch + synchronous stale-state clear on wallet change.
  useEffect(() => {
    const generation = ++generationRef.current;
    // Drop pending sign-in state on wallet change.
    setIsAuthenticating(false);
    setError(null);

    if (!address) {
      if (sessionRef.current) {
        void runCookieMutation(() => serverLogout());
      }
      setSession(null);
      return;
    }

    const prev = sessionRef.current;
    if (prev && prev.address !== address.toLowerCase()) {
      // The cookie may belong to the previous account — clear it.
      setSession(null);
      void runCookieMutation(() => serverLogout());
    }

    (async () => {
      try {
        // Let queued cookie mutations land first.
        await cookieQueue.current;
        if (!isCurrent(generation)) return;
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!isCurrent(generation) || !res.ok) return;
        const data = await res.json();
        if (!isCurrent(generation)) return;
        const next = data.session as SessionPayload | null;
        if (next && next.address === address.toLowerCase()) {
          setSession(next);
        } else if (next) {
          setSession(null);
          void runCookieMutation(() => serverLogout());
        }
      } catch {
        // No existing session
      }
    })();
  }, [address, isCurrent, runCookieMutation, serverLogout]);

  const login = useCallback(async () => {
    const wallet = addressRef.current;
    if (!wallet) {
      setError("No wallet connected");
      return;
    }

    // Bump so an in-flight /me cannot overwrite this login's session.
    const generation = ++generationRef.current;
    setIsAuthenticating(true);
    setError(null);

    try {
      const nonceRes = await fetch("/api/auth/evm-login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet }),
      });

      if (!nonceRes.ok) {
        const err = await nonceRes.json().catch(() => ({}));
        throw new Error(err.message || "Failed to get nonce");
      }

      const { nonce, message } = await nonceRes.json();
      if (!nonce || !message) {
        throw new Error("No nonce returned");
      }
      if (!isCurrent(generation)) return;

      const signature = await signMessageAsync({ message });
      if (!isCurrent(generation)) return;

      await runCookieMutation(async () => {
        // A newer mutation may have been queued while the user signed.
        if (!isCurrent(generation)) return;
        const loginRes = await fetch("/api/auth/evm-login", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: wallet, nonce, signature }),
        });

        if (!isCurrent(generation)) {
          // Stale mid-flight — undo the cookie inside this queue task.
          await serverLogout().catch(() => new Response());
          return;
        }

        if (!loginRes.ok) {
          const err = await loginRes.json().catch(() => ({}));
          throw new Error(err.message || "Login failed");
        }

        const data = await loginRes.json();
        if (!isCurrent(generation)) {
          await serverLogout().catch(() => new Response());
          return;
        }
        const next = data.session as SessionPayload | null;
        if (!next) {
          throw new Error("No session returned");
        }
        setSession(next);
      });
    } catch (err) {
      if (!isCurrent(generation)) return;
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setError(msg);
    } finally {
      if (isCurrent(generation)) setIsAuthenticating(false);
    }
  }, [signMessageAsync, isCurrent, runCookieMutation, serverLogout]);

  // Only expose a session matching the connected wallet.
  const liveSession =
    session && address && session.address === address.toLowerCase()
      ? session
      : null;

  return (
    <WalletAuthContext.Provider
      value={{
        session: liveSession,
        isAuthenticated: !!liveSession,
        isAuthenticating,
        error,
        login,
        logout,
      }}
    >
      {children}
    </WalletAuthContext.Provider>
  );
}

export function useWalletAuth(): WalletAuthContextValue {
  const ctx = useContext(WalletAuthContext);
  if (ctx) return ctx;

  // Inert local fallback outside the provider (tests, non-wallet pages).
  return {
    session: null,
    isAuthenticated: false,
    isAuthenticating: false,
    error: null,
    login: async () => {},
    logout: async () => {},
  };
}
