/**
 * Kite Settlement API
 *
 * POST /api/kite/settle — Settle agent revenue on Kite chain
 * GET  /api/kite/balance — Get agent wallet balances
 * POST /api/kite/rules — Configure spending rules
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/app/lib/auth/session";
import { apiError } from "@/app/lib/api/response";
import {
  settleAgentRevenue,
  getAgentBalances,
  configureSpendingRules,
  isKiteConfigured,
} from "@/app/lib/kite-settlement";

export const dynamic = "force-dynamic";

async function getSession(req: NextRequest) {
  const token = req.cookies.get("spinchain-session")?.value
    || req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifySession(token);
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return apiError("Authentication required", "FORBIDDEN", 403);
  }

  const configured = isKiteConfigured();
  if (!configured) {
    return NextResponse.json({
      configured: false,
      balances: { kiteBalance: "0", usdcBalance: "0" },
    });
  }

  try {
    const { kiteBalance, usdcBalance } = await getAgentBalances();
    return NextResponse.json({
      configured: true,
      balances: {
        kiteBalance: kiteBalance.toString(),
        usdcBalance: usdcBalance.toString(),
      },
    });
  } catch {
    return apiError("Failed to fetch balances", "INTERNAL_ERROR", 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return apiError("Authentication required", "FORBIDDEN", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return apiError("Request body required", "MISSING_FIELD", 400);
  }

  const { action } = body;

  if (action === "settle") {
    const { revenue, classId, recipient } = body;
    if (typeof revenue !== "number" || revenue <= 0) {
      return apiError("revenue must be a positive number", "VALIDATION_FAILED", 400);
    }
    if (typeof classId !== "string" || !classId) {
      return apiError("classId required", "MISSING_FIELD", 400);
    }
    if (typeof recipient !== "string" || !recipient.startsWith("0x")) {
      return apiError("recipient address required", "MISSING_FIELD", 400);
    }

    const result = await settleAgentRevenue(
      revenue,
      classId,
      recipient as `0x${string}`,
    );
    return NextResponse.json(result);
  }

  if (action === "rules") {
    const { rules } = body;
    if (!Array.isArray(rules) || rules.length === 0) {
      return apiError("rules array required", "VALIDATION_FAILED", 400);
    }

    const formatted = rules.map((r: any) => ({
      tokenAddress: r.tokenAddress,
      maxAmountPerTx: BigInt(r.maxAmountPerTx),
      maxTotalAmount: BigInt(r.maxTotalAmount),
      windowSeconds: BigInt(r.windowSeconds),
    }));

    const success = await configureSpendingRules(formatted);
    return NextResponse.json({ success });
  }

  return apiError("Unknown action", "VALIDATION_FAILED", 400);
}
