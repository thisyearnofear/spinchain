// /api/redeem/sign — issuer signing for the phase-5 testnet pilot.
// Session + DB are mocked; the EIP-712 signature is verified by recovering
// the signer against the exact domain the contract will check.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { keccak256, recoverTypedDataAddress, stringToHex, verifyTypedData } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const OWNER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
// Deterministic throwaway issuer — derived from a tag, no real key material.
const ISSUER_KEY = keccak256(stringToHex("spinchain.test.issuer.v1"));
const ISSUER_ADDRESS = privateKeyToAccount(ISSUER_KEY).address;
const REDEEMER = "0x1234567890abcdef1234567890abcdef12345678";

const db = vi.hoisted(() => ({
  ride: null as {
    id: string;
    rider_address: string;
    class_id: string;
    elapsed_time: number;
    completed_at: string | null;
    summary: { telemetrySource?: string } | null;
  } | null,
  queryError: null as { message: string } | null,
}));

vi.mock("@/app/lib/auth/session", () => ({
  verifySession: vi.fn(async (token: string) =>
    token === "owner-token" ? { address: OWNER, role: "rider", exp: 0 } : null,
  ),
}));

vi.mock("@/app/lib/supabase/client", () => ({
  isSupabaseConfigured: () => true,
  getServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: db.ride, error: db.queryError }),
          }),
        }),
      }),
    }),
  }),
}));

import { POST } from "@/app/api/redeem/sign/route";
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
import { AVALANCHE_FUJI } from "@/app/lib/contracts";

const RIDE = {
  id: "demo-ride-42",
  rider_address: OWNER,
  class_id: "class-7",
  elapsed_time: 1800,
  completed_at: null,
  summary: { telemetrySource: "live-bike" },
};

function req(body: unknown, token?: string) {
  return POST(
    new NextRequest(
      new Request("http://localhost/api/redeem/sign", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      }),
    ),
  );
}

function enableIssuer() {
  vi.stubEnv("PILOT_REDEEM_ENABLED", "true");
  vi.stubEnv("REDEEMER_ISSUER_PRIVATE_KEY", ISSUER_KEY);
  vi.stubEnv("NEXT_PUBLIC_ACHIEVEMENT_REDEEMER_ADDRESS", REDEEMER);
}

beforeEach(() => {
  db.ride = RIDE;
  db.queryError = null;
  enableIssuer();
});

describe("POST /api/redeem/sign", () => {
  it("404s when the pilot flag is off", async () => {
    vi.stubEnv("PILOT_REDEEM_ENABLED", "");
    const res = await req({ rideId: RIDE.id }, "owner-token");
    expect(res.status).toBe(404);
  });

  it("rejects unauthenticated callers", async () => {
    const res = await req({ rideId: RIDE.id });
    expect(res.status).toBe(401);
  });

  it("rejects a missing ride id", async () => {
    const res = await req({}, "owner-token");
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("MISSING_FIELD");
  });

  it("rejects rides the issuer cannot see (no cloud_history sync)", async () => {
    db.ride = null;
    const res = await req({ rideId: RIDE.id }, "owner-token");
    expect(res.status).toBe(403);
  });

  it("rejects rides below the pilot minimum", async () => {
    db.ride = { ...RIDE, elapsed_time: PILOT_MIN_RIDE_SEC - 1 };
    const res = await req({ rideId: RIDE.id }, "owner-token");
    expect(res.status).toBe(422);
  });

  it("signs a valid receipt for a synced ride", async () => {
    const res = await req({ rideId: RIDE.id }, "owner-token");
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.issuer).toBe(ISSUER_ADDRESS);
    expect(body.receipt.recipient).toBe(OWNER);
    expect(body.receipt.sessionId).toBe(deriveRideSessionId(RIDE.id));
    expect(body.receipt.classId).toBe(deriveRideClassId(RIDE.class_id));
    expect(body.receipt.campaignId).toBe(PILOT_CAMPAIGN_ID);
    expect(body.receipt.policyHash).toBe(PILOT_POLICY_HASH);
    expect(BigInt(body.receipt.amount)).toBe(PILOT_AMOUNT);
    expect(body.receipt.expiresAt - body.receipt.issuedAt).toBe(
      PILOT_RECEIPT_TTL_SEC,
    );

    expect(body.attestation.provider).toBe("spinchain.cloud-observed.v1");
    expect(body.attestation.provenance).toBe("device-observed");
    expect(body.attestation.trustStatement).toContain("not independently verified");

    // The signature must recover to the issuer under the exact on-chain domain.
    const domain = {
      name: REDEEMER_EIP712_DOMAIN_NAME,
      version: REDEEMER_EIP712_VERSION,
      chainId: AVALANCHE_FUJI.id,
      verifyingContract: REDEEMER,
    } as const;
    const message = {
      ...body.receipt,
      amount: BigInt(body.receipt.amount),
    };
    const recovered = await recoverTypedDataAddress({
      domain,
      types: RECEIPT_EIP712_TYPES,
      primaryType: "Receipt",
      message,
      signature: body.signature,
    });
    expect(recovered.toLowerCase()).toBe(ISSUER_ADDRESS.toLowerCase());
  });

  it("domain-binds the signature: wrong chain or contract fails recovery", async () => {
    const res = await req({ rideId: RIDE.id }, "owner-token");
    const body = await res.json();
    const message = { ...body.receipt, amount: BigInt(body.receipt.amount) };

    for (const domain of [
      { name: REDEEMER_EIP712_DOMAIN_NAME, version: REDEEMER_EIP712_VERSION, chainId: 43114, verifyingContract: REDEEMER },
      { name: REDEEMER_EIP712_DOMAIN_NAME, version: REDEEMER_EIP712_VERSION, chainId: AVALANCHE_FUJI.id, verifyingContract: OWNER },
    ] as const) {
      const ok = await verifyTypedData({
        address: ISSUER_ADDRESS,
        domain,
        types: RECEIPT_EIP712_TYPES,
        primaryType: "Receipt",
        message,
        signature: body.signature,
      });
      expect(ok).toBe(false);
    }
  });

  it("produces a deterministic sessionId for the same ride", async () => {
    const r1 = await (await req({ rideId: RIDE.id }, "owner-token")).json();
    const r2 = await (await req({ rideId: RIDE.id }, "owner-token")).json();
    expect(r1.receipt.sessionId).toBe(r2.receipt.sessionId);
    // issuedAt may differ but sessionId (and thus the nullifier) does not —
    // the on-chain ClaimRegistry makes replay impossible.
  });
});
