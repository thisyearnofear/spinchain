import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/app/lib/api/response";
import { getServerClient } from "@/app/lib/supabase/client";
import { verifySession } from "@/app/lib/auth/session";
import { normalizeSummaryForWrite } from "@/app/lib/analytics/ride-summary-normalize";

export const dynamic = "force-dynamic";

/**
 * Ride Summaries API
 *
 * GET  /api/rides?limit=50&offset=0 — list rides for authenticated rider
 * POST /api/rides — save a ride summary
 * DELETE /api/rides?id=xxx — delete a ride
 */

interface RideSummaryRow {
  id: string;
  idempotency_key?: string;
  rider_address: string;
  class_id?: string | null;
  class_name?: string | null;
  instructor?: string | null;
  completed_at: string;
  elapsed_time: number;
  avg_effort: number;
  avg_heart_rate?: number | null;
  avg_power?: number | null;
  effort_tier?: string | null;
  zones?: Record<string, number> | null;
  walrus_blob_id?: string | null;
  sync_status?: string;
  summary?: Record<string, unknown> | null;
}

async function getAuthPayload(request: NextRequest) {
  const token = request.cookies.get("spinchain-session")?.value
    || request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifySession(token);
}

function parsePositiveInt(raw: string | null, fallback: number): number | null {
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

export async function GET(request: NextRequest) {
  const payload = await getAuthPayload(request);
  if (!payload) {
    return apiError("Unauthorized", "FORBIDDEN", 401);
  }

  const client = getServerClient();
  if (!client) {
    return apiError("Database not configured", "NOT_CONFIGURED", 503);
  }

  const { searchParams } = new URL(request.url);
  const limit = parsePositiveInt(searchParams.get("limit"), 50);
  const offset = parsePositiveInt(searchParams.get("offset"), 0);
  if (limit === null || limit === 0 || limit > 200 || offset === null) {
    return apiError("Invalid limit or offset", "VALIDATION_FAILED", 400);
  }

  const { data, error } = await client
    .from("ride_summaries")
    .select("*")
    .eq("rider_address", payload.address)
    .order("completed_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return apiError("Failed to fetch rides", "INTERNAL_ERROR", 500, error.message);
  }

  return apiOk({ rides: data as RideSummaryRow[], count: data.length });
}

export async function POST(request: NextRequest) {
  const payload = await getAuthPayload(request);
  if (!payload) {
    return apiError("Unauthorized", "FORBIDDEN", 401);
  }

  const client = getServerClient();
  if (!client) {
    return apiError("Database not configured", "NOT_CONFIGURED", 503);
  }

  let body: Partial<RideSummaryRow>;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "INVALID_FORMAT", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return apiError("Invalid JSON body", "INVALID_FORMAT", 400);
  }

  if (typeof body.id !== "string" || !body.id) {
    return apiError("Missing ride id", "MISSING_FIELD", 400);
  }
  const idempotencyKey =
    typeof body.idempotency_key === "string" && body.idempotency_key
      ? body.idempotency_key
      : null;
  if (!idempotencyKey) {
    return apiError("Missing idempotency key", "MISSING_FIELD", 400);
  }

  const row: RideSummaryRow = {
    id: body.id,
    idempotency_key: idempotencyKey,
    rider_address: payload.address,
    class_id: body.class_id || null,
    class_name: body.class_name || null,
    instructor: body.instructor || null,
    completed_at: body.completed_at || new Date().toISOString(),
    elapsed_time: body.elapsed_time || 0,
    avg_effort: body.avg_effort || 0,
    avg_heart_rate: body.avg_heart_rate || null,
    avg_power: body.avg_power || null,
    effort_tier: body.effort_tier || null,
    zones: body.zones || null,
    walrus_blob_id: body.walrus_blob_id || null,
    sync_status: "synced",
  };

  // Canonical summary whitelist; identity fields forced from the session.
  if (body.summary !== undefined && body.summary !== null) {
    const normalized = normalizeSummaryForWrite(body.summary, {
      id: row.id,
      idempotencyKey,
      riderId: payload.address,
    });
    if (!normalized.ok) {
      return apiError(normalized.message, normalized.status === 403 ? "FORBIDDEN" : "VALIDATION_FAILED", normalized.status);
    }
    row.summary = normalized.summary;
  }

  // INSERT first; a 23505 unique violation falls through to an owner-scoped
  // update of mutable fields only.
  const { data: inserted, error: insertError } = await client
    .from("ride_summaries")
    .insert(row)
    .select()
    .single();

  if (!insertError) {
    return apiOk(inserted, 201);
  }

  if (insertError.code !== "23505") {
    return apiError("Failed to save ride", "INTERNAL_ERROR", 500, insertError.message);
  }

  // Mutable fields only — identity columns are never updated.
  const {
    id: _id,
    idempotency_key: _ik,
    rider_address: _ra,
    ...mutable
  } = row;

  const { data: updated, error: updateError } = await client
    .from("ride_summaries")
    .update(mutable)
    .eq("id", row.id)
    .eq("idempotency_key", row.idempotency_key!)
    .eq("rider_address", payload.address)
    .select()
    .maybeSingle();

  if (updateError) {
    return apiError("Failed to save ride", "INTERNAL_ERROR", 500, updateError.message);
  }
  if (!updated) {
    // Conflict: identity exists but belongs to a different rider.
    return apiError("Ride identity conflict", "FORBIDDEN", 403);
  }

  return apiOk(updated, 200);
}

export async function DELETE(request: NextRequest) {
  const payload = await getAuthPayload(request);
  if (!payload) {
    return apiError("Unauthorized", "FORBIDDEN", 401);
  }

  const client = getServerClient();
  if (!client) {
    return apiError("Database not configured", "NOT_CONFIGURED", 503);
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return apiError("Missing ride id", "MISSING_FIELD", 400);
  }

  const { error } = await client
    .from("ride_summaries")
    .delete()
    .eq("id", id)
    .eq("rider_address", payload.address);

  if (error) {
    return apiError("Failed to delete ride", "INTERNAL_ERROR", 500, error.message);
  }

  return apiOk({ deleted: true });
}
