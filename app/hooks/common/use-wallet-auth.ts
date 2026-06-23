"use client";

import { useState, useCallback, useEffect } from "react";
import { useCurrentAccount, useSignPersonalMessage } from "@mysten/dapp-kit";
import { verifySession, type SessionPayload } from "@/app/lib/auth/session";

/**
 * useWalletAuth — wallet-based authentication with Supabase.
 *
 * Flow:
 * 1. User connects Sui wallet (handled by dApp Kit)
 * 2. call login() — requests nonce, signs with wallet, submits to /api/auth/sui-login
 * 3. Server returns JWT in httpOnly cookie
 * 4. session state is populated
 *
 * If Supabase is not configured, auth is a no-op (localStorage-only mode).
 */

export function useWalletAuth() {
  const account = useCurrentAccount();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    if (!account) return;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data.session) {
            setSession(data.session);
          }
        }
      } catch {
        // No existing session
      }
    })();
  }, [account]);

  const login = useCallback(async () => {
    if (!account) {
      setError("No wallet connected");
      return;
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      // Step 1: Get nonce
      const nonceRes = await fetch("/api/auth/sui-login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: account.address }),
      });

      if (!nonceRes.ok) {
        const err = await nonceRes.json();
        throw new Error(err.message || "Failed to get nonce");
      }

      const { nonce } = await nonceRes.json();
      if (!nonce) {
        throw new Error("No nonce returned");
      }

      // Step 2: Sign nonce with Sui wallet
      const message = new TextEncoder().encode(
        `Sign in to SpinChain\n\nNonce: ${nonce}`,
      );
      const { signature, bytes } = await signPersonalMessage({
        message,
      });

      // Step 3: Submit signature
      const loginRes = await fetch("/api/auth/sui-login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: account.address,
          nonce,
          signature,
          publicKey: account.publicKey || bytes,
        }),
      });

      if (!loginRes.ok) {
        const err = await loginRes.json();
        throw new Error(err.message || "Login failed");
      }

      const { token } = await loginRes.json();
      const payload = await verifySession(token);
      if (payload) {
        setSession(payload);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setError(msg);
    } finally {
      setIsAuthenticating(false);
    }
  }, [account, signPersonalMessage]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // Ignore
    }
    setSession(null);
  }, []);

  return {
    session,
    isAuthenticated: !!session,
    isAuthenticating,
    error,
    login,
    logout,
  };
}
