import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/app/lib/api/response";
import { getServerClient } from "@/app/lib/supabase/client";
import { verifySession } from "@/app/lib/auth/session";
import {
  isServerConsentScope,
  SERVER_CONSENT_POLICY_VERSION,
} from "@/app/lib/privacy/consent-server";

export const dynamic = "force-dynamic";

/**
 * Rider consent API (owner-scoped)
 *
 * GET /api/consent — list this rider's consent records
 * PUT /api/consent — { scope, granted, policyVersion } upsert one scope
 */

async function getAuthPayload(request: NextRequest) {
  const token = request.cookies.get("spinchain-session")?.value
    || request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifySession(token);
}

export async function GET(request: NextRequest) {
  const payload = await getAuthPayload(request);
  if (!payload) return apiError("Unauthorized", "FORBIDDEN", 401);

  const client = getServerClient();
  if (!client) return apiError("Database not configured", "NOT_CONFIGURED", 503);

  const { data, error } = await client
    .from("rider_consents")
    .select("scope, granted, policy_version, updated_at")
    .eq("address", payload.address);
  if (error) return apiError("Failed to load consent", "INTERNAL_ERROR", 500);

  return apiOk({ consents: data ?? [] });
}

export async function PUT(request: NextRequest) {
  const payload = await getAuthPayload(request);
  if (!payload) return apiError("Unauthorized", "FORBIDDEN", 401);

  const client = getServerClient();
  if (!client) return apiError("Database not configured", "NOT_CONFIGURED", 503);

  let body: { scope?: unknown; granted?: unknown; policyVersion?: unknown };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "INVALID_FORMAT", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return apiError("Invalid JSON body", "INVALID_FORMAT", 400);
  }
  if (!isServerConsentScope(body.scope)) {
    return apiError("Unknown consent scope", "VALIDATION_FAILED", 400);
  }
  if (typeof body.granted !== "boolean") {
    return apiError("granted must be a boolean", "VALIDATION_FAILED", 400);
  }
  // A grant must be made against the policy text the server currently serves.
  if (body.granted && body.policyVersion !== SERVER_CONSENT_POLICY_VERSION) {
    return apiError("Stale consent policy version", "VALIDATION_FAILED", 409);
  }

  const row = {
    address: payload.address,
    scope: body.scope,
    granted: body.granted,
    policy_version: SERVER_CONSENT_POLICY_VERSION,
    updated_at: new Date().toISOString(),
  };
  const { error } = await client
    .from("rider_consents")
    .upsert(row, { onConflict: "address,scope" });
  if (error) return apiError("Failed to save consent", "INTERNAL_ERROR", 500);

  return apiOk({ scope: row.scope, granted: row.granted, policyVersion: row.policy_version });
}
