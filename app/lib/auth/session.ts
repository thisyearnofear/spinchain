import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

export interface SessionPayload {
  address: string;
  role: "rider" | "instructor";
  exp: number;
}

/**
 * Generate a random nonce for wallet sign-in.
 * Stored in Supabase with a 5-minute expiry.
 */
export async function generateNonce(address: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

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
 * Verify that a nonce is valid, unused, and not expired.
 * Marks it as used on successful verification.
 */
export async function verifyNonce(nonce: string, address: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return false;

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await client
    .from("auth_nonces")
    .select("nonce, address, expires_at, used")
    .eq("nonce", nonce)
    .single();

  if (error || !data) return false;
  if (data.used) return false;
  if (data.address !== address.toLowerCase()) return false;
  if (new Date(data.expires_at) < new Date()) return false;

  await client.from("auth_nonces").update({ used: true }).eq("nonce", nonce);

  return true;
}

/**
 * Create a JWT for the authenticated user.
 * Uses Supabase's built-in JWT signing via the service role key.
 */
export async function createSession(
  address: string,
  role: "rider" | "instructor",
): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days

  const { data, error } = await client.auth.admin.generateLink({
    type: "magiclink",
    email: `${address.toLowerCase()}@spinchain.auth`,
    options: {
      data: { address: address.toLowerCase(), role, exp },
    },
  });

  if (error) {
    // Fallback: create an HMAC-signed token to prevent tampering
    // WARNING: This is NOT a full JWT. Use a proper JWT library in production.
    const payload: SessionPayload = { address: address.toLowerCase(), role, exp };
    const payloadB64 = btoa(JSON.stringify(payload));
    if (JWT_SECRET) {
      const signature = await hmacSign(JWT_SECRET, payloadB64);
      return `${payloadB64}.${signature}`;
    }
    // Without JWT_SECRET, we cannot sign — log a warning
    console.warn("[auth] SUPABASE_JWT_SECRET not set — session tokens are unsigned!");
    return payloadB64;
  }

  // Extract token from the generated link
  const token = data.properties?.action_link?.split("token=")[1];
  return token ?? null;
}

/**
 * Verify a JWT from the client.
 */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    // Check for HMAC-signed token format (payload.signature)
    const parts = token.split(".");
    let payloadB64: string;

    if (parts.length === 2 && JWT_SECRET) {
      // Signed token — verify HMAC
      const [payloadPart, signature] = parts;
      const expectedSignature = await hmacSign(JWT_SECRET, payloadPart);
      if (signature !== expectedSignature) {
        return null; // Signature mismatch — token tampered
      }
      payloadB64 = payloadPart;
    } else if (parts.length === 1) {
      // Legacy unsigned token — only accept if no JWT_SECRET configured
      if (JWT_SECRET) {
        console.warn("[auth] Rejecting unsigned token when JWT_SECRET is configured");
        return null;
      }
      payloadB64 = token;
    } else {
      return null; // Invalid format
    }

    const payload = JSON.parse(atob(payloadB64)) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.address || !payload.role || !payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * HMAC-SHA256 sign a message using the JWT secret.
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
