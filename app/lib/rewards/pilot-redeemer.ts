import {
  encodeAbiParameters,
  keccak256,
  stringToHex,
  type Address,
} from "viem";
import { ACTIVE_NETWORK, AVALANCHE_FUJI } from "@/app/lib/contracts";

/**
 * Phase-5 testnet pilot: issuer-signed receipt redemption against
 * AchievementRedeemerV2 + ClaimRegistry on Avalanche Fuji.
 *
 * Trust statement (per docs/ACHIEVEMENT-REDEEMER-V2.md): a redemption means
 * "an authorized SpinChain issuer approved this session under this policy" —
 * nothing more. Not ZK integrity, not physical-world provenance.
 *
 * Pilot economics are deliberately trivial test-token values: 10 SPIN(Fuji)
 * per eligible ride, 100 cap per user, one redemption per session via the
 * on-chain nullifier.
 */

export const PILOT_CAMPAIGN_ID = keccak256(
  stringToHex("spinchain.pilot.rides.v1"),
);
export const PILOT_POLICY_HASH = keccak256(
  stringToHex("spinchain.pilot.policy.v1"),
);
/** 10 test SPIN per eligible ride — testnet asset, no value. */
export const PILOT_AMOUNT = 10n * 10n ** 18n;
/** A ride must be at least this long for the issuer to approve it. */
export const PILOT_MIN_RIDE_SEC = 600;
/** Signed receipts stay valid this long (contract enforces <= maxLifetime). */
export const PILOT_RECEIPT_TTL_SEC = 7 * 24 * 60 * 60;

export const REDEEMER_EIP712_DOMAIN_NAME = "SpinChain AchievementRedeemer";
export const REDEEMER_EIP712_VERSION = "2";

export const RECEIPT_EIP712_TYPES = {
  Receipt: [
    { name: "recipient", type: "address" },
    { name: "sessionId", type: "bytes32" },
    { name: "classId", type: "bytes32" },
    { name: "policyHash", type: "bytes32" },
    { name: "campaignId", type: "bytes32" },
    { name: "amount", type: "uint256" },
    { name: "issuedAt", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

/** keccak256("spinchain.achievement.nullifier.v1") — mirrors the contract. */
export const NULLIFIER_DOMAIN = keccak256(
  stringToHex("spinchain.achievement.nullifier.v1"),
);

export interface RedeemReceipt {
  recipient: Address;
  sessionId: `0x${string}`;
  classId: `0x${string}`;
  policyHash: `0x${string}`;
  campaignId: `0x${string}`;
  amount: bigint;
  issuedAt: number;
  expiresAt: number;
}

export interface SignedRedeemPayload {
  receipt: Omit<RedeemReceipt, "amount"> & { amount: string };
  issuer: Address;
  signature: `0x${string}`;
}

/**
 * The issuer derives sessionId from the synced ride id, never from
 * client-supplied telemetry — the approval binds to a ride the server
 * observed via cloud_history sync.
 */
export function deriveRideSessionId(rideId: string): `0x${string}` {
  return keccak256(stringToHex(`spinchain.ride.v1:${rideId}`));
}

export function deriveRideClassId(classId: string | null): `0x${string}` {
  return keccak256(stringToHex(`spinchain.class.v1:${classId ?? "none"}`));
}

/** Mirrors AchievementRedeemerV2.nullifierFor — (campaign, session) bound. */
export function rideNullifier(sessionId: `0x${string}`): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }],
      [NULLIFIER_DOMAIN, PILOT_CAMPAIGN_ID, sessionId],
    ),
  );
}

export function pilotRedeemerAddress(): Address | null {
  const addr = process.env.NEXT_PUBLIC_ACHIEVEMENT_REDEEMER_ADDRESS;
  return addr && /^0x[0-9a-fA-F]{40}$/.test(addr) ? (addr as Address) : null;
}

/** Client-side gate: pilot flag AND Fuji. Legacy claim flags stay untouched. */
export function isPilotRedeemEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_PILOT_REDEEM_ENABLED === "true" &&
    ACTIVE_NETWORK.id === AVALANCHE_FUJI.id
  );
}

export const ACHIEVEMENT_REDEEMER_V2_ABI = [
  {
    name: "redeem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "r",
        type: "tuple",
        components: [
          { name: "recipient", type: "address" },
          { name: "sessionId", type: "bytes32" },
          { name: "classId", type: "bytes32" },
          { name: "policyHash", type: "bytes32" },
          { name: "campaignId", type: "bytes32" },
          { name: "amount", type: "uint256" },
          { name: "issuedAt", type: "uint64" },
          { name: "expiresAt", type: "uint64" },
        ],
      },
      { name: "issuer", type: "address" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "nullifier", type: "bytes32" }],
  },
  {
    name: "nullifierFor",
    type: "function",
    stateMutability: "pure",
    inputs: [
      { name: "campaignId", type: "bytes32" },
      { name: "sessionId", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "receiptDigest",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "r",
        type: "tuple",
        components: [
          { name: "recipient", type: "address" },
          { name: "sessionId", type: "bytes32" },
          { name: "classId", type: "bytes32" },
          { name: "policyHash", type: "bytes32" },
          { name: "campaignId", type: "bytes32" },
          { name: "amount", type: "uint256" },
          { name: "issuedAt", type: "uint64" },
          { name: "expiresAt", type: "uint64" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "remainingBudget",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "campaignId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "redeemedBy",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "campaignId", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
