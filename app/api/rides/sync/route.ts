import { NextRequest, NextResponse } from "next/server";

type RideSyncPayload = {
  id?: string;
  idempotencyKey?: string;
  avgEffort?: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RideSyncPayload;
    if (!body?.id || !body?.idempotencyKey) {
      return NextResponse.json({ error: "Invalid ride summary payload" }, { status: 400 });
    }

    const shouldAnchor = (body.avgEffort ?? 0) >= 700;
    const txHash = shouldAnchor
      ? (`0x${Buffer.from(body.idempotencyKey).toString("hex").slice(0, 64).padEnd(64, "0")}` as `0x${string}`)
      : undefined;

    return NextResponse.json({
      relayed: true,
      commitmentTxHash: txHash,
      relayTs: Date.now(),
    });
  } catch {
    return NextResponse.json({ error: "Failed to process relay payload" }, { status: 500 });
  }
}