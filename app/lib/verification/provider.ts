import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Phase 3 — verification-provider interface.
 *
 * A provider decides whether a recorded ride/session is eligible for an
 * issuer signature, and reports the *honest* provenance class of what it
 * saw. Providers never invent telemetry: they only approve rides that the
 * system can point to (cloud history row, studio feed, wearable record).
 *
 * Attestation meaning is deliberately narrow:
 *   provider-attested  = a named external system vouched for the session
 *   device-observed    = telemetry was reported from a real device source
 *   simulated          = synthetic/demo telemetry
 *   estimated          = source unknown or self-reported without evidence
 *
 * None of these alone imply independent physical-world verification — that
 * is what the trustStatement is for; it must be shown verbatim wherever an
 * attestation is presented.
 */

export type AttestationProvenance =
  | "provider-attested"
  | "device-observed"
  | "simulated"
  | "estimated";

export interface VerificationRequest {
  /** Wallet address that owns the session/receipt. */
  riderAddress: string;
  /** Server-visible ride record id (ride_summaries.id). */
  rideId: string;
}

export interface VerificationContext {
  db: SupabaseClient;
}

export interface VerifiedSession {
  sessionId: `0x${string}`;
  classId: `0x${string}`;
  provenance: AttestationProvenance;
  /** Ride duration in seconds as recorded server-side. */
  elapsedTimeSec: number;
}

export type VerificationDecision =
  | { status: "verified"; session: VerifiedSession }
  | { status: "rejected"; reason: string }
  | { status: "unavailable"; reason: string };

export interface VerificationProvider {
  /** Stable provider id, e.g. "spinchain.cloud-observed.v1". */
  id: string;
  /** Short human label for attestations, e.g. "SpinChain cloud history". */
  label: string;
  /** Exact trust statement — surfaced verbatim in UI/attestations. */
  trustStatement: string;
  verify(
    req: VerificationRequest,
    ctx: VerificationContext,
  ): Promise<VerificationDecision>;
}

const registry = new Map<string, VerificationProvider>();

export function registerVerificationProvider(provider: VerificationProvider) {
  registry.set(provider.id, provider);
}

export function getVerificationProvider(
  id: string,
): VerificationProvider | undefined {
  return registry.get(id);
}

export const DEFAULT_PROVIDER_ID = "spinchain.cloud-observed.v1";
