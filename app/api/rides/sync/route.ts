import { NextRequest, NextResponse } from "next/server";
import type { Address } from "viem";
import { CONTRACT_ADDRESSES, INCENTIVE_ENGINE_ABI } from "@/app/lib/contracts";

export const dynamic = 'force-dynamic';

/**
 * Ride Sync API - Anchors ride commitments to Avalanche
 *
 * Production Requirements:
 * - RELAYER_PRIVATE_KEY: Environment variable for backend wallet
 * - Or integrate with Gelato/OpenZeppelin Defender for gasless relaying
 *
 * Flow:
 * 1. Client completes ride and generates ZK proof locally
 * 2. Client submits proof to this endpoint (or directly to contract)
 * 3. If using relayer mode, backend submits tx and returns hash
 * 4. If direct mode, validates proof and returns success
 */

// Validation constants
const MIN_EFFORT_FOR_ANCHORING = 700; // Only anchor high-effort rides
const MAX_PROOF_SIZE = 2048; // bytes
const MAX_PUBLIC_INPUTS = 10;

type RideSyncPayload = {
  id: string;
  idempotencyKey: string;
  avgEffort: number;
  classId?: string;
  riderAddress?: Address;
  proof?: `0x${string}`;
  publicInputs?: `0x${string}`[];
  timestamp?: number;
};

type SyncResponse = {
  relayed: boolean;
  relayTs: number;
  mode: "relayer" | "direct" | "validation_only";
  message?: string;
  contractCall?: {
    address: `0x${string}`;
    abi: typeof INCENTIVE_ENGINE_ABI;
    functionName: "submitZKProof";
    args: [`0x${string}`, `0x${string}`[]];
  };
};

/**
 * Validates ride payload for required fields and constraints
 */
function validatePayload(body: unknown): { valid: true; data: RideSyncPayload } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid payload format" };
  }

  const payload = body as Record<string, unknown>;

  // Required fields
  if (!payload.id || typeof payload.id !== "string") {
    return { valid: false, error: "Missing required field: id" };
  }
  if (!payload.idempotencyKey || typeof payload.idempotencyKey !== "string") {
    return { valid: false, error: "Missing required field: idempotencyKey" };
  }
  if (typeof payload.avgEffort !== "number" || payload.avgEffort < 0 || payload.avgEffort > 1000) {
    return { valid: false, error: "Invalid avgEffort: must be 0-1000" };
  }

  // Optional proof validation
  if (payload.proof) {
    if (typeof payload.proof !== "string" || !payload.proof.startsWith("0x")) {
      return { valid: false, error: "Invalid proof format: must be hex string" };
    }
    if ((payload.proof.length - 2) / 2 > MAX_PROOF_SIZE) {
      return { valid: false, error: `Proof too large: max ${MAX_PROOF_SIZE} bytes` };
    }
  }

  if (payload.publicInputs) {
    if (!Array.isArray(payload.publicInputs)) {
      return { valid: false, error: "publicInputs must be an array" };
    }
    if (payload.publicInputs.length > MAX_PUBLIC_INPUTS) {
      return { valid: false, error: `Too many public inputs: max ${MAX_PUBLIC_INPUTS}` };
    }
  }

  return {
    valid: true,
    data: {
      id: payload.id,
      idempotencyKey: payload.idempotencyKey,
      avgEffort: payload.avgEffort,
      classId: payload.classId as string | undefined,
      riderAddress: payload.riderAddress as Address | undefined,
      proof: payload.proof as `0x${string}` | undefined,
      publicInputs: payload.publicInputs as `0x${string}`[] | undefined,
      timestamp: payload.timestamp as number | undefined,
    },
  };
}

/**
 * Check if relayer mode is available (has private key)
 */
function isRelayerModeAvailable(): boolean {
  return !!process.env.RELAYER_PRIVATE_KEY;
}

export async function POST(req: NextRequest): Promise<NextResponse<SyncResponse>> {
  try {
    const rawBody = await req.json();
    const validation = validatePayload(rawBody);

    if (!validation.valid) {
      return NextResponse.json(
        {
          relayed: false,
          relayTs: Date.now(),
          mode: "validation_only",
          message: validation.error,
        },
        { status: 400 }
      );
    }

    const body = validation.data;
    const shouldAnchor = body.avgEffort >= MIN_EFFORT_FOR_ANCHORING;

    // If no proof provided, just validate and return
    if (!body.proof) {
      return NextResponse.json({
        relayed: false,
        relayTs: Date.now(),
        mode: "validation_only",
        message: shouldAnchor
          ? `Effort ${body.avgEffort} qualifies for anchoring. Submit proof to complete.`
          : `Effort ${body.avgEffort} below threshold ${MIN_EFFORT_FOR_ANCHORING}`,
      });
    }

    // Validate proof has required public inputs
    if (!body.publicInputs || body.publicInputs.length < 4) {
      return NextResponse.json(
        {
          relayed: false,
          relayTs: Date.now(),
          mode: "validation_only",
          message: "Proof submitted but publicInputs are missing or incomplete",
        },
        { status: 400 }
      );
    }

    // Relayer mode: submit transaction on behalf of user
    if (isRelayerModeAvailable()) {
      return NextResponse.json({
        relayed: false,
        relayTs: Date.now(),
        mode: "relayer",
        message: "Relayer mode is configured but transaction submission is not implemented yet.",
      }, { status: 501 });
    }

    // Direct mode: Client should submit proof directly to contract
    // This endpoint validates and returns contract call data
    return NextResponse.json({
      relayed: false,
      relayTs: Date.now(),
      mode: "direct",
      message: "Proof validated. Client must submit IncentiveEngine.submitZKProof() directly.",
      // Provide contract call data for client-side submission
      contractCall: {
        address: CONTRACT_ADDRESSES.INCENTIVE_ENGINE,
        abi: INCENTIVE_ENGINE_ABI,
        functionName: "submitZKProof",
        args: [body.proof, body.publicInputs],
      },
    });
  } catch (error) {
    console.error("[RideSync] Error processing request:", error);
    return NextResponse.json(
      {
        relayed: false,
        relayTs: Date.now(),
        mode: "validation_only",
        message: error instanceof Error ? error.message : "Failed to process ride sync",
      },
      { status: 500 }
    );
  }
}
