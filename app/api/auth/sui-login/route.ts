import { NextRequest, NextResponse } from "next/server";
import { apiError, apiOk } from "@/app/lib/api/response";
import { checkRateLimit } from "@/app/lib/api/rate-limiter";
import {
  consumeNonce,
  createSession,
  generateNonce,
  isRequestOriginAllowed,
} from "@/app/lib/auth/session";
import { SUI_ADDRESS_RE } from "@/app/lib/auth/types";
import { getServerClient } from "@/app/lib/supabase/client";

export const dynamic = "force-dynamic";

/**
 * Wallet-based authentication endpoint.
 *
 * POST /api/auth/sui-login
 * Step 1: { address } -> { nonce }  (client signs nonce with wallet)
 * Step 2: { address, nonce, signature } -> { token, role, address }
 *
 * The Sui signature is verified via verifyPersonalMessageSignature — the
 * serialized signature carries its public key, so the wallet address is
 * recovered, not trusted. The nonce is consumed atomically only AFTER the
 * signature verifies.
 */

interface LoginRequestBody {
  address: string;
  nonce?: string;
  signature?: string;
  publicKey?: string;
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "INVALID_FORMAT", 400);
  }
  if (typeof body !== "object" || body === null) {
    return apiError("Invalid JSON body", "INVALID_FORMAT", 400);
  }
  const { address: rawAddress, nonce, signature } = body as LoginRequestBody;

  if (!rawAddress || typeof rawAddress !== "string") {
    return apiError("Missing address field", "MISSING_FIELD", 400);
  }

  const address = rawAddress.toLowerCase();
  if (!SUI_ADDRESS_RE.test(address)) {
    return apiError("Invalid address", "VALIDATION_FAILED", 400);
  }

  // Step 1: Request nonce
  if (!nonce && !signature) {
    const nonce = await generateNonce(address);
    if (!nonce) {
      return apiError(
        "Auth backend not configured. Set SUPABASE env vars.",
        "NOT_CONFIGURED",
        503,
      );
    }
    return apiOk({ nonce });
  }

  // Step 2: Verify signature BEFORE consuming the nonce.
  if (!nonce || !signature) {
    return apiError("Missing nonce or signature", "MISSING_FIELD", 400);
  }

  // SECURITY: Verify the Sui signature server-side — the serialized
  // signature recovers the signer address; no publicKey is trusted.
  try {
    const { verifyPersonalMessageSignature } = await import("@mysten/sui/verify");
    const message = new TextEncoder().encode(`Sign in to SpinChain\n\nNonce: ${nonce}`);
    const publicKey = await verifyPersonalMessageSignature(
      message,
      signature as `0x${string}`,
    );
    // Verify the recovered address matches the claimed address
    const verifiedAddress = publicKey.toSuiAddress();
    if (verifiedAddress !== address) {
      return apiError("Signature does not match claimed address", "FORBIDDEN", 403);
    }
  } catch (verifyError) {
    console.error("[auth] Signature verification failed:", verifyError);
    return apiError("Invalid signature verification", "FORBIDDEN", 403);
  }

  const consumed = await consumeNonce(nonce, address);
  if (!consumed) {
    return apiError("Invalid or expired nonce", "FORBIDDEN", 403);
  }

  // Determine role: instructor if they have published classes on-chain
  const role = await determineRole(address);

  // Create session
  const token = await createSession(address, role);
  if (!token) {
    return apiError("Failed to create session", "INTERNAL_ERROR", 500);
  }

  // Upsert rider profile (creates a stub if not exists)
  const client = getServerClient();
  if (client) {
    await client
      .from("rider_profiles")
      .upsert({ address }, { onConflict: "address", ignoreDuplicates: true })
      .select();
  }

  const response = NextResponse.json({ token, role, address });
  response.cookies.set("spinchain-session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: "/",
  });

  return response;
}

async function determineRole(_address: string): Promise<"rider" | "instructor"> {
  // Check if address has published any on-chain classes
  // For now, default to "rider" — instructor detection will be
  // implemented when we wire up on-chain class queries
  // TODO: Query SpinClassNFT.sol for instructor classes
  return "rider";
}
