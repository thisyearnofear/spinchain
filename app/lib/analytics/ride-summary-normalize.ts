import type { RideSummary } from "./ride-history";
import { parseRideReceipt } from "./ride-receipt";

/**
 * Canonical whitelist for the ride_summaries.summary jsonb column, shared by
 * the API write sanitizer and the hydration read mapper.
 */

export interface SummaryIdentity {
  id: string;
  idempotencyKey: string;
  riderId: string;
}

const TELEMETRY_SOURCES = ["live-bike", "simulator", "estimated"] as const;
const EFFORT_TIERS = ["bronze", "silver", "gold", "platinum"] as const;
const PROOF_MODES = ["none", "zk-batch", "yellow-stream"] as const;
const PROOF_STATUSES = ["idle", "requested", "ready", "claimed", "failed"] as const;
const PRIVACY_LEVELS = ["high", "medium", "low"] as const;
const CHAIN_STATUSES = ["pending", "confirmed", "failed", "skipped"] as const;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function isStr(v: unknown): v is string {
  return typeof v === "string";
}
function isTxHash(v: unknown): v is `0x${string}` {
  return isStr(v) && /^0x[0-9a-fA-F]{64}$/.test(v);
}
function pickEnum<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return isStr(v) && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

export function normalizeZones(v: unknown): RideSummary["zones"] | undefined {
  if (!isObj(v)) return undefined;
  const keys = ["recovery", "endurance", "threshold", "sprint"] as const;
  const out: Record<string, number> = {};
  for (const k of keys) {
    if (!isNum(v[k])) return undefined;
    out[k] = v[k] as number;
  }
  return out as RideSummary["zones"];
}

export function normalizeProof(v: unknown): RideSummary["proof"] | undefined {
  if (!isObj(v)) return undefined;
  return {
    mode: pickEnum(v.mode, PROOF_MODES) ?? "none",
    status: pickEnum(v.status, PROOF_STATUSES) ?? "idle",
    isVerified: v.isVerified === true,
    privacyScore: isNum(v.privacyScore) ? v.privacyScore : 0,
    privacyLevel: pickEnum(v.privacyLevel, PRIVACY_LEVELS) ?? "high",
    ...(isNum(v.verifiedScore) ? { verifiedScore: v.verifiedScore } : {}),
  };
}

function normalizeChainResult(
  v: unknown,
  withEpoch: boolean,
): RideSummary["settlement"] | undefined {
  if (!isObj(v)) return undefined;
  return {
    attempted: v.attempted === true,
    ...(isTxHash(v.txHash) ? { txHash: v.txHash } : {}),
    status: pickEnum(v.status, CHAIN_STATUSES) ?? "skipped",
    ...(withEpoch && isNum(v.commitmentEpoch)
      ? { commitmentEpoch: v.commitmentEpoch }
      : {}),
  };
}

export type NormalizeSummaryResult =
  | { ok: true; summary: Record<string, unknown> }
  | { ok: false; status: 400 | 403; message: string };

/** Validate + whitelist a client-supplied summary; identity forced from `identity`. */
export function normalizeSummaryForWrite(
  value: unknown,
  identity: SummaryIdentity,
): NormalizeSummaryResult {
  if (!isObj(value)) {
    return { ok: false, status: 400, message: "Invalid summary object" };
  }
  if (Array.isArray(value.heartRateSamples)) {
    return { ok: false, status: 400, message: "Raw telemetry is not accepted" };
  }
  if (
    isStr(value.riderId) &&
    value.riderId.toLowerCase() !== identity.riderId.toLowerCase()
  ) {
    return { ok: false, status: 403, message: "Summary riderId does not match session" };
  }

  const out: Record<string, unknown> = {
    schemaVersion: "1.0",
    id: identity.id,
    idempotencyKey: identity.idempotencyKey,
    riderId: identity.riderId,
  };

  for (const key of ["classId", "className", "instructor"] as const) {
    if (isStr(value[key])) out[key] = value[key];
  }
  const tier = pickEnum(value.effortTier, EFFORT_TIERS);
  if (tier) out.effortTier = tier;
  const source = pickEnum(value.telemetrySource, TELEMETRY_SOURCES);
  if (source) out.telemetrySource = source;
  for (const key of [
    "completedAt",
    "durationSec",
    "avgHeartRate",
    "avgPower",
    "avgEffort",
    "spinEarned",
  ] as const) {
    if (isNum(value[key])) out[key] = value[key];
  }

  if (value.zones !== undefined && !isObj(value.zones)) {
    return { ok: false, status: 400, message: "Invalid summary.zones" };
  }
  const zones = normalizeZones(value.zones);
  if (zones) out.zones = zones;
  if (value.proof !== undefined && !isObj(value.proof)) {
    return { ok: false, status: 400, message: "Invalid summary.proof" };
  }
  const proof = normalizeProof(value.proof);
  if (proof) out.proof = proof;
  if (value.settlement !== undefined && !isObj(value.settlement)) {
    return { ok: false, status: 400, message: "Invalid summary.settlement" };
  }
  const settlement = normalizeChainResult(value.settlement, false);
  if (settlement) out.settlement = settlement;
  if (value.anchoring !== undefined && !isObj(value.anchoring)) {
    return { ok: false, status: 400, message: "Invalid summary.anchoring" };
  }
  const anchoring = normalizeChainResult(value.anchoring, true);
  if (anchoring) out.anchoring = anchoring;

  if (value.receipt !== undefined) {
    if (!isObj(value.receipt)) {
      return { ok: false, status: 400, message: "Invalid summary.receipt" };
    }
    const receipt = parseRideReceipt(value.receipt);
    if (!receipt) {
      return { ok: false, status: 400, message: "Invalid summary.receipt" };
    }
    if (receipt.riderId.toLowerCase() !== identity.riderId.toLowerCase()) {
      return { ok: false, status: 403, message: "Receipt riderId does not match session" };
    }
    // The receipt must describe this canonical row exactly.
    if (
      receipt.receiptId !== identity.id ||
      receipt.classId !== out.classId ||
      receipt.completedAt !== out.completedAt ||
      receipt.durationSec !== out.durationSec
    ) {
      return { ok: false, status: 400, message: "Receipt does not match ride summary" };
    }
    const expectedProvenance =
      out.telemetrySource === "simulator"
        ? "simulated"
        : out.telemetrySource === "live-bike"
          ? "device-observed"
          : "estimated";
    if (receipt.provenance !== expectedProvenance) {
      return { ok: false, status: 400, message: "Receipt provenance does not match telemetry source" };
    }
    out.receipt = { ...receipt, riderId: identity.riderId };
  }

  return { ok: true, summary: out };
}

/** Read-side: validate a stored summary blob for hydration. */
export function normalizeSummaryForRead(value: unknown): Record<string, unknown> | null {
  if (!isObj(value)) return null;
  // Identity is checked by the caller.
  const res = normalizeSummaryForWrite(value, {
    id: String(value.id ?? ""),
    idempotencyKey: String(value.idempotencyKey ?? ""),
    riderId: String(value.riderId ?? ""),
  });
  if (res.ok) return res.summary;
  // A receipt that no longer matches the row must not hide the ride itself.
  if (value.receipt !== undefined) {
    const { receipt: _receipt, ...rest } = value;
    const retry = normalizeSummaryForWrite(rest, {
      id: String(value.id ?? ""),
      idempotencyKey: String(value.idempotencyKey ?? ""),
      riderId: String(value.riderId ?? ""),
    });
    return retry.ok ? retry.summary : null;
  }
  return null;
}
