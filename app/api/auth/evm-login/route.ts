import { NextRequest, NextResponse } from "next/server";
import { isAddress, verifyMessage } from "viem";
import { apiError, apiOk } from "@/app/lib/api/response";
import { checkRateLimit } from "@/app/lib/api/rate-limiter";
import {
  consumeNonce,
  createSession,
  generateNonce,
  isRequestOriginAllowed,
  verifySession,
} from "@/app/lib/auth/session";
import { getWalletSignInMessage } from "@/app/lib/auth/message";
import { getServerClient } from "@/app/lib/supabase/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/evm-login
 * Step 1: { address } -> { nonce, message }  (client signs `message`)
 * Step 2: { address, nonce, signature } -> sets session cookie, returns
 *         { session: { address, role, exp } }
 */

interface LoginRequestBody {
  address: string;
  nonce?: string;
  signature?: string;
}

export async function POST(request: NextRequest) {
  if (!isRequestOriginAllowed(request)) {
    return apiError("Origin mismatch", "FORBIDDEN", 403);
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rate = checkRateLimit(`auth:${ip}`);
  if (!rate.allowed) {
    return apiError("Too many requests", "RATE_LIMITED", 429);
  }

  let body: LoginRequestBody;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "INVALID_FORMAT", 400);
  }

  if (!body || typeof body !== "object" || typeof body.address !== "string") {
    return apiError("Missing address field", "MISSING_FIELD", 400);
  }

  if (!isAddress(body.address)) {
    return apiError("Invalid address", "VALIDATION_FAILED", 400);
  }

  const address = body.address.toLowerCase();
  const origin = request.nextUrl.origin;

  // Step 1: Request nonce + the exact message to sign
  if (!body.nonce && !body.signature) {
    const nonce = await generateNonce(address);
    if (!nonce) {
      return apiError(
        "Auth backend not configured. Set SESSION_SECRET and Supabase env vars.",
        "NOT_CONFIGURED",
        503,
      );
    }
    return apiOk({ nonce, message: getWalletSignInMessage(address, nonce, origin) });
  }

  // Step 2: Verify signature, then consume nonce, then issue session
  if (
    typeof body.nonce !== "string" ||
    !body.nonce ||
    typeof body.signature !== "string" ||
    !body.signature
  ) {
    return apiError("Missing nonce or signature", "MISSING_FIELD", 400);
  }

  const message = getWalletSignInMessage(address, body.nonce, origin);

  let valid: boolean;
  try {
    valid = await verifyMessage({
      address: body.address as `0x${string}`,
      message,
      signature: body.signature as `0x${string}`,
    });
  } catch {
    return apiError("Invalid signature", "FORBIDDEN", 403);
  }
  if (!valid) {
    return apiError("Signature does not match", "FORBIDDEN", 403);
  }

  // Consume only after signature verification so a bad sig can't burn it.
  const consumed = await consumeNonce(body.nonce, address);
  if (!consumed) {
    return apiError("Invalid or expired nonce", "FORBIDDEN", 403);
  }

  const token = await createSession(address, "rider");
  if (!token) {
    return apiError("Failed to create session", "INTERNAL_ERROR", 500);
  }

  // Ensure a rider profile stub exists for ride_summaries FK.
  const client = getServerClient();
  if (client) {
    const { error: profileError } = await client
      .from("rider_profiles")
      .upsert({ address }, { onConflict: "address", ignoreDuplicates: true })
      .select();
    if (profileError) {
      return apiError("Failed to create profile", "INTERNAL_ERROR", 500);
    }
  }

  const session = await verifySession(token);
  if (!session) {
    return apiError("Failed to create session", "INTERNAL_ERROR", 500);
  }

  const response = NextResponse.json({ session });
  response.cookies.set("spinchain-session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: "/",
  });

  return response;
}
