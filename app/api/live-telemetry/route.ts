import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/app/lib/api/response";
import { getServerClient } from "@/app/lib/supabase/client";
import { verifySession } from "@/app/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Live Telemetry API
 *
 * GET  /api/live-telemetry?classId=<id>  — aggregated live telemetry for a class (instructor)
 * POST /api/live-telemetry               — rider pushes telemetry update (upsert)
 * DELETE /api/live-telemetry?classId=<id> — rider clears their live telemetry on ride end
 */

async function getAuthPayload(request: NextRequest) {
  const token = request.cookies.get("spinchain-session")?.value
    || request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifySession(token);
}

const STALE_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const client = getServerClient();
  if (!client) {
    return apiError("Database not configured", "NOT_CONFIGURED", 503);
  }

  const payload = await getAuthPayload(request);
  if (!payload) {
    return apiError("Unauthorized", "FORBIDDEN", 401);
  }

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");
  if (!classId) {
    return apiError("classId is required", "MISSING_FIELD", 400);
  }

  const cutoff = new Date(Date.now() - STALE_MS).toISOString();

  const { data: rows, error } = await client
    .from("live_telemetry")
    .select("rider_address, heart_rate, power, cadence, effort, elapsed_sec, updated_at")
    .eq("class_id", classId)
    .gte("updated_at", cutoff)
    .order("updated_at", { ascending: false });

  if (error) {
    return apiError("Failed to fetch live telemetry", "INTERNAL_ERROR", 500);
  }

  const active = rows ?? [];
  const count = active.length;

  if (count === 0) {
    return apiOk({
      classId,
      activeRiders: 0,
      avgPower: 0,
      avgHeartRate: 0,
      avgEffort: 0,
      avgCadence: 0,
      riders: [],
    });
  }

  const avgPower = Math.round(active.reduce((s, r) => s + r.power, 0) / count);
  const avgHeartRate = Math.round(active.reduce((s, r) => s + r.heart_rate, 0) / count);
  const avgEffort = Math.round(active.reduce((s, r) => s + r.effort, 0) / count);
  const avgCadence = Math.round(active.reduce((s, r) => s + r.cadence, 0) / count);

  return apiOk({
    classId,
    activeRiders: count,
    avgPower,
    avgHeartRate,
    avgEffort,
    avgCadence,
    riders: active.map((r) => ({
      address: r.rider_address,
      heartRate: r.heart_rate,
      power: r.power,
      cadence: r.cadence,
      effort: r.effort,
      elapsedSec: r.elapsed_sec,
      updatedAt: r.updated_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const client = getServerClient();
  if (!client) {
    return apiError("Database not configured", "NOT_CONFIGURED", 503);
  }

  const payload = await getAuthPayload(request);
  if (!payload) {
    return apiError("Unauthorized", "FORBIDDEN", 401);
  }

  let body: {
    classId?: string;
    heartRate?: number;
    power?: number;
    cadence?: number;
    effort?: number;
    elapsedSec?: number;
  };

  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "INVALID_FORMAT", 400);
  }

  if (!body.classId) {
    return apiError("classId is required", "MISSING_FIELD", 400);
  }

  const { error } = await client
    .from("live_telemetry")
    .upsert({
      class_id: body.classId,
      rider_address: payload.address,
      heart_rate: body.heartRate ?? 0,
      power: body.power ?? 0,
      cadence: body.cadence ?? 0,
      effort: body.effort ?? 0,
      elapsed_sec: body.elapsedSec ?? 0,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "class_id,rider_address",
    });

  if (error) {
    return apiError("Failed to update live telemetry", "INTERNAL_ERROR", 500);
  }

  return apiOk({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const client = getServerClient();
  if (!client) {
    return apiError("Database not configured", "NOT_CONFIGURED", 503);
  }

  const payload = await getAuthPayload(request);
  if (!payload) {
    return apiError("Unauthorized", "FORBIDDEN", 401);
  }

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");
  if (!classId) {
    return apiError("classId is required", "MISSING_FIELD", 400);
  }

  const { error } = await client
    .from("live_telemetry")
    .delete()
    .eq("class_id", classId)
    .eq("rider_address", payload.address);

  if (error) {
    return apiError("Failed to clear live telemetry", "INTERNAL_ERROR", 500);
  }

  return apiOk({ ok: true });
}
