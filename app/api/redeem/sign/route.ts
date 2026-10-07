import { NextRequest } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import type { Address } from "viem";
import { apiError, apiOk } from "@/app/lib/api/response";
import { verifySession } from "@/app/lib/auth/session";
import { getServerClient } from "@/app/lib/supabase/client";
import { AVALANCHE_FUJI } from "@/app/lib/contracts";
import {
  PILOT_CAMPAIGN_ID,
  PILOT_POLICY_HASH,
  PILOT_AMOUNT,
  PILOT_MIN_RIDE_SEC,
  PILOT_RECEIPT_TTL_SEC,
  REDEEMER_EIP712_DOMAIN_NAME,
  REDEEMER_EIP712_VERSION,
  RECEIPT_EIP712_TYPES,
  deriveRideSessionId,
  deriveRideClassId,
} from "@/app/lib/rewards/pilot-redeemer";

export const dynamic = "force-dynamic";

/**
 * POST /api/redeem/sign — phase-5 testnet pilot issuer.
 *
 * Signs an EIP-712 Receipt for AchievementRedeemerV2.redeem on Fuji.
 *
 * Pilot policy (spinchain.pilot.policy.v1):
 * - caller holds a wallet session; the recipient is always the session wallet
 * - the ride exists server-side via cloud_history sync — the issuer only
 *   approves sessions it observed (never client-asserted telemetry)
 * - ride elapsed_time >= 10 min
 * - one redemption per (campaign, session) enforced on-chain via the
 *   ClaimRegistry nullifier; budget/cap enforced by the campaign
 */
export async function POST(request: NextRequest) {
  if (process.env.PILOT_REDEEM_ENABLED !== "true") {
    return apiError("Pilot redemption is not enabled", "NOT_CONFIGURED", 404);
  }

  const token =
    request.cookies.get("spinchain-session")?.value ||
    request.headers.get("authorization")?.replace(/^Bearer /i, "");
  const payload = token ? await verifySession(token) : null;
  if (!payload) {
    return apiError("Unauthorized", "FORBIDDEN", 401);
  }

  const issuerKey = process.env.REDEEMER_ISSUER_PRIVATE_KEY;
  const redeemer = process.env.NEXT_PUBLIC_ACHIEVEMENT_REDEEMER_ADDRESS;
  if (
    !issuerKey ||
    !/^0x[0-9a-fA-F]{64}$/.test(issuerKey) ||
    !redeemer ||
    !/^0x[0-9a-fA-F]{40}$/.test(redeemer)
  ) {
    return apiError("Issuer not configured", "NOT_CONFIGURED", 503);
  }

  let body: { rideId?: unknown };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "INVALID_FORMAT", 400);
  }
  if (typeof body?.rideId !== "string" || !body.rideId) {
    return apiError("Missing ride id", "MISSING_FIELD", 400);
  }
  const rideId = body.rideId;

  const client = getServerClient();
  if (!client) {
    return apiError("Database not configured", "NOT_CONFIGURED", 503);
  }

  // The issuer only signs for rides it can see: the row must exist in cloud
  // history and belong to this wallet. A rider without cloud_history consent
  // gets 403 — honest state, not a dead button.
  const { data: ride, error } = await client
    .from("ride_summaries")
    .select("id, rider_address, class_id, elapsed_time, completed_at")
    .eq("id", rideId)
    .eq("rider_address", payload.address)
    .maybeSingle();

  if (error) {
    return apiError("Failed to look up ride", "INTERNAL_ERROR", 500, error.message);
  }
  if (!ride) {
    return apiError(
      "Ride not found in cloud history — sync must complete (cloud_history consent) before the issuer can approve it",
      "FORBIDDEN",
      403,
    );
  }
  if ((ride.elapsed_time ?? 0) < PILOT_MIN_RIDE_SEC) {
    return apiError(
      `Ride below pilot minimum (${PILOT_MIN_RIDE_SEC}s)`,
      "VALIDATION_FAILED",
      422,
    );
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const receipt = {
    recipient: payload.address as Address,
    sessionId: deriveRideSessionId(ride.id),
    classId: deriveRideClassId(ride.class_id),
    policyHash: PILOT_POLICY_HASH,
    campaignId: PILOT_CAMPAIGN_ID,
    amount: PILOT_AMOUNT,
    issuedAt: now,
    expiresAt: now + BigInt(PILOT_RECEIPT_TTL_SEC),
  };

  const issuer = privateKeyToAccount(issuerKey as `0x${string}`);
  const signature = await issuer.signTypedData({
    domain: {
      name: REDEEMER_EIP712_DOMAIN_NAME,
      version: REDEEMER_EIP712_VERSION,
      chainId: AVALANCHE_FUJI.id,
      verifyingContract: redeemer as Address,
    },
    types: RECEIPT_EIP712_TYPES,
    primaryType: "Receipt",
    message: receipt,
  });

  return apiOk({
    receipt: {
      ...receipt,
      amount: receipt.amount.toString(),
      issuedAt: Number(receipt.issuedAt),
      expiresAt: Number(receipt.expiresAt),
    },
    issuer: issuer.address,
    signature,
  });
}
