import type { RideSummary } from "./ride-history";

export interface RideReceiptV1 {
  version: 1;
  receiptId: string;
  sessionId: string;
  riderId: string;
  classId: string;
  completedAt: number;
  durationSec: number;
  policyVersion: "ride-record-v1";
  provenance: "simulated" | "device-observed" | "estimated";
  progression: { rideRecorded: true };
  verification: { status: "unverified"; issuer: null };
  redemption: { status: "unavailable"; reason: "redemption-not-enabled" };
  telemetryCommitment: null;
}

const PROVENANCE_BY_SOURCE: Record<
  RideSummary["telemetrySource"],
  RideReceiptV1["provenance"]
> = {
  simulator: "simulated",
  "live-bike": "device-observed",
  estimated: "estimated",
};

export function createRideReceipt(
  summary: RideSummary,
  sessionId: string,
): RideReceiptV1 {
  if (!sessionId) {
    throw new Error("RideReceiptV1 requires a stable ride session id");
  }
  return {
    version: 1,
    receiptId: summary.id,
    sessionId,
    riderId: summary.riderId,
    classId: summary.classId,
    completedAt: summary.completedAt,
    durationSec: summary.durationSec,
    policyVersion: "ride-record-v1",
    provenance: PROVENANCE_BY_SOURCE[summary.telemetrySource],
    progression: { rideRecorded: true },
    verification: { status: "unverified", issuer: null },
    redemption: { status: "unavailable", reason: "redemption-not-enabled" },
    telemetryCommitment: null,
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyStr(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function isNonNegativeNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

const RAW_TELEMETRY_FIELDS = [
  "heartRateSamples",
  "powerSamples",
  "cadenceSamples",
  "telemetry",
  "rawSamples",
  "samples",
] as const;

const FORBIDDEN_UPGRADE_FIELDS = [
  "txHash",
  "proof",
  "proofHash",
  "signature",
  "claimable",
  "spinEarned",
] as const;

export function parseRideReceipt(value: unknown): RideReceiptV1 | null {
  if (!isObj(value)) return null;
  if (value.version !== 1) return null;

  for (const key of RAW_TELEMETRY_FIELDS) {
    if (Array.isArray(value[key])) return null;
  }
  for (const key of FORBIDDEN_UPGRADE_FIELDS) {
    if (value[key] !== undefined) return null;
  }

  if (
    !isNonEmptyStr(value.receiptId) ||
    !isNonEmptyStr(value.sessionId) ||
    !isNonEmptyStr(value.riderId) ||
    !isNonEmptyStr(value.classId)
  ) {
    return null;
  }
  if (!isNonNegativeNum(value.completedAt) || !isNonNegativeNum(value.durationSec)) {
    return null;
  }
  if (value.policyVersion !== "ride-record-v1") return null;

  const provenance = value.provenance;
  if (
    provenance !== "simulated" &&
    provenance !== "device-observed" &&
    provenance !== "estimated"
  ) {
    return null;
  }

  const progression = value.progression;
  if (!isObj(progression) || progression.rideRecorded !== true) return null;

  const verification = value.verification;
  if (
    !isObj(verification) ||
    verification.status !== "unverified" ||
    verification.issuer !== null
  ) {
    return null;
  }

  const redemption = value.redemption;
  if (
    !isObj(redemption) ||
    redemption.status !== "unavailable" ||
    redemption.reason !== "redemption-not-enabled"
  ) {
    return null;
  }

  if (value.telemetryCommitment !== null) return null;

  return {
    version: 1,
    receiptId: value.receiptId,
    sessionId: value.sessionId,
    riderId: value.riderId,
    classId: value.classId,
    completedAt: value.completedAt,
    durationSec: value.durationSec,
    policyVersion: "ride-record-v1",
    provenance,
    progression: { rideRecorded: true },
    verification: { status: "unverified", issuer: null },
    redemption: { status: "unavailable", reason: "redemption-not-enabled" },
    telemetryCommitment: null,
  };
}
