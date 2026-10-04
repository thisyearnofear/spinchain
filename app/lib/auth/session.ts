import type { NextRequest } from "next/server";
import { getServerClient } from "@/app/lib/supabase/client";
import {
  isValidSessionAddress,
  isValidSessionExp,
  isValidSessionRole,
  SIGNATURE_HEX_RE,
  type SessionPayload,
} from "./types";

// Own session-signing secret for wallet auth tokens (HMAC-SHA256).
// Deliberately NOT Supabase's JWT secret — our tokens are ours to sign.
// Must be >= 32 characters. Generate: openssl rand -hex 32
const SESSION_SECRET = process.env.SESSION_SECRET;

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export function isAuthConfigured(): boolean {
  return typeof SESSION_SECRET === "string" && SESSION_SECRET.length >= 32;
}

/**
 * True when the request has no Origin header (same-origin fetches may omit it)
 * or the Origin matches the deployment origin. Rejects cross-origin posts.
 */
export function isRequestOriginAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === request.nextUrl.origin;
}

/**
 * Generate a random nonce for wallet sign-in.
 * Stored in Supabase with a 5-minute expiry.
 * Requires both the signing secret and the DB — fail closed otherwise.
 */
export async function generateNonce(address: string): Promise<string | null> {
  if (!isAuthConfigured()) return null;
  const client = getServerClient();
  if (!client) return null;

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const { error } = await client.from("auth_nonces").insert({
    nonce,
    address: address.toLowerCase(),
    expires_at: expiresAt,
  });

  if (error) {
    console.error("[auth] Failed to store nonce:", error.message);
    return null;
  }

  return nonce;
}

/**
 * Atomically consume a nonce: marks it used ONLY if it exists, belongs to the
 * address, is unused, and unexpired. Single conditional UPDATE — no
 * read-then-update window for replay races.
 */
export async function consumeNonce(nonce: string, address: string): Promise<boolean> {
  const client = getServerClient();
  if (!client) return false;

  const { data, error } = await client
    .from("auth_nonces")
    .update({ used: true })
    .eq("nonce", nonce)
    .eq("address", address.toLowerCase())
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .select("nonce")
    .maybeSingle();

  return !error && !!data;
}

/**
 * Create a signed session token for the authenticated wallet.
 * Opaque token format: base64(payload).hex(hmac-sha256)
 * Returns null when signing is not configured (>=32-char SESSION_SECRET).
 */
export async function createSession(
  address: string,
  role: SessionPayload["role"],
): Promise<string | null> {
  if (!isAuthConfigured()) return null;
  if (!isValidSessionAddress(address.toLowerCase())) return null;
  if (!isValidSessionRole(role)) return null;

  const payload: SessionPayload = {
    address: address.toLowerCase(),
    role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const payloadB64 = btoa(JSON.stringify(payload));
  const signature = await hmacSign(SESSION_SECRET!, payloadB64);
  return `${payloadB64}.${signature}`;
}

/**
 * Verify a session token. Rejects unsigned, tampered, malformed, expired, or
 * schema-invalid tokens. Fail-closed when SESSION_SECRET is not configured.
 */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  if (!token || !isAuthConfigured()) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadB64, signature] = parts;
    if (!SIGNATURE_HEX_RE.test(signature)) return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(SESSION_SECRET!),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signatureBytes = new Uint8Array(
      signature.match(/../g)!.map((b) => parseInt(b, 16)),
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(payloadB64),
    );
    if (!valid) return null;

    const payload = JSON.parse(atob(payloadB64)) as SessionPayload;
    if (!payload || typeof payload !== "object") return null;
    if (!isValidSessionRole(payload.role)) return null;
    if (!isValidSessionAddress(payload.address)) return null;
    if (!isValidSessionExp(payload.exp)) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * HMAC-SHA256 sign a message using the session secret.
 * Uses Web Crypto API (available in Edge Runtime).
 */
async function hmacSign(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
