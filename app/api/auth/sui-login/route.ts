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

  // SECURITY: Verify the Sui signature server-side.
  // Without this verification, ANY client can forge a valid session
  // by submitting any address + nonce without actually signing with their wallet.
  //
  // We reconstruct the signed message ("Sign in to SpinChain\n\nNonce: <nonce>")
  // and verify using @mysten/sui verifyPersonalMessageSignature.
  try {
    const { verifyPersonalMessageSignature } = await import("@mysten/sui/verify");
    const message = new TextEncoder().encode(`Sign in to SpinChain\n\nNonce: ${body.nonce}`);
    const publicKey = await verifyPersonalMessageSignature(
      message,
      body.signature as `0x${string}`,
    );
    // Verify the public key matches the claimed address
    const verifiedAddress = publicKey.toSuiAddress();
    if (verifiedAddress !== address) {
      return apiError("Signature does not match claimed address", "FORBIDDEN", 403);
    }
  } catch (verifyError) {
    console.error("[auth] Signature verification failed:", verifyError);
    return apiError("Invalid signature verification", "FORBIDDEN", 403);
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

async function determineRole(address: string): Promise<"rider" | "instructor"> {
  // Check if address has published any on-chain classes
  // For now, default to "rider" — instructor detection will be
  // implemented when we wire up on-chain class queries
  // TODO: Query SpinClassNFT.sol for instructor classes
  void address;
  return "rider";
}
