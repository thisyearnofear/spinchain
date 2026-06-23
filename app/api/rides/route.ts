import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/app/lib/api/response";
import { getServerClient } from "@/app/lib/supabase/client";
import { verifySession } from "@/app/lib/auth/session";

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
}

async function getAuthPayload(request: NextRequest) {
  const token = request.cookies.get("spinchain-session")?.value
    || request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifySession(token);
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
  const limit = Math.min(Number(searchParams.get("limit") || "50"), 200);
  const offset = Number(searchParams.get("offset") || "0");

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

  if (!body.id) {
    return apiError("Missing ride id", "MISSING_FIELD", 400);
  }

  const row: RideSummaryRow = {
    id: body.id,
    idempotency_key: body.idempotency_key || body.id,
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

  const { data, error } = await client
    .from("ride_summaries")
    .upsert(row, { onConflict: "idempotency_key" })
    .select()
    .single();

  if (error) {
    return apiError("Failed to save ride", "INTERNAL_ERROR", 500, error.message);
  }

  return apiOk(data, 201);
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
