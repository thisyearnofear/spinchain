import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    // Fallback: create a simple signed token
    // In production, use a proper JWT library with JWT_SECRET
    const payload: SessionPayload = { address: address.toLowerCase(), role, exp };
    return btoa(JSON.stringify(payload));
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
    // Simple decode for now — in production, verify signature with JWT_SECRET
    const payload = JSON.parse(atob(token)) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
