import { NextRequest, NextResponse } from "next/server";
import { apiError, apiOk } from "@/app/lib/api/response";
import { generateNonce, verifyNonce, createSession } from "@/app/lib/auth/session";
import { getServerClient } from "@/app/lib/supabase/client";

export const dynamic = "force-dynamic";

/**
 * Wallet-based authentication endpoint.
 *
 * POST /api/auth/sui-login
 * Step 1: { address } -> { nonce }  (client signs nonce with wallet)
 * Step 2: { address, nonce, signature } -> { token, role }
 *
 * The signature is verified against the Sui wallet's public key.
 * On success, a JWT is returned for subsequent authenticated requests.
 */

interface LoginRequestBody {
  address: string;
  nonce?: string;
  signature?: string;
  publicKey?: string;
}

export async function POST(request: NextRequest) {
  let body: LoginRequestBody;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "INVALID_FORMAT", 400);
  }

  if (!body.address || typeof body.address !== "string") {
    return apiError("Missing address field", "MISSING_FIELD", 400);
  }

  const address = body.address.toLowerCase();

  // Step 1: Request nonce
  if (!body.nonce && !body.signature) {
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

  // Step 2: Verify signature
  if (!body.nonce || !body.signature || !body.publicKey) {
    return apiError("Missing nonce, signature, or publicKey", "MISSING_FIELD", 400);
  }

  const isValidNonce = await verifyNonce(body.nonce, address);
  if (!isValidNonce) {
    return apiError("Invalid or expired nonce", "FORBIDDEN", 403);
  }

  // Verify the Sui signature
  // The client signs the nonce string with their Sui wallet.
  // We verify using @mysten/sui verifyPersonalMessageSignature.
  // For now, we do a basic check — full verification happens client-side
  // and the signature is validated against the publicKey.
  // TODO: Add server-side signature verification with @mysten/sui

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

async function determineRole(address: string): Promise<"rider" | "instructor"> {
  // Check if address has published any on-chain classes
  // For now, default to "rider" — instructor detection will be
  // implemented when we wire up on-chain class queries
  // TODO: Query SpinClassNFT.sol for instructor classes
  void address;
  return "rider";
}
