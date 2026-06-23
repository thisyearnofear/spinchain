import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/app/lib/api/response";
import { getServerClient } from "@/app/lib/supabase/client";
import { verifySession } from "@/app/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Homework API
 *
 * GET  /api/homework?rider=0x...           — list homework for a rider (rider sees own, instructor sees assigned)
 * GET  /api/homework?id=xxx                — single homework by ID
 * POST /api/homework                        — instructor assigns homework
 * PUT  /api/homework?id=xxx                 — update homework (mark complete, change due date)
 */

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
  const id = searchParams.get("id");
  const rider = searchParams.get("rider");
  const status = searchParams.get("status");

  // Single homework by ID
  if (id) {
    const { data, error } = await client
      .from("homework_assignments")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return apiError("Homework not found", "FORBIDDEN", 404, error.message);
    }

    // Verify access
    if (data.rider_address !== payload.address && data.instructor_address !== payload.address) {
      return apiError("Forbidden", "FORBIDDEN", 403);
    }

    return apiOk(data);
  }

  // List homework — riders see their own, instructors see what they assigned
  let query = client.from("homework_assignments").select("*");

  if (rider) {
    // If instructor requesting a specific rider's homework
    if (rider !== payload.address) {
      // Verify the requester is an instructor who has taught this rider
      query = query.eq("rider_address", rider).eq("instructor_address", payload.address);
    } else {
      query = query.eq("rider_address", rider);
    }
  } else {
    // No rider filter — show all homework where user is rider or instructor
    query = query.or(`rider_address.eq.${payload.address},instructor_address.eq.${payload.address}`);
  }

  if (status) {
    query = query.eq("status", status);
  }

  query = query.order("assigned_at", { ascending: false }).limit(100);

  const { data, error } = await query;

  if (error) {
    return apiError("Failed to fetch homework", "INTERNAL_ERROR", 500, error.message);
  }

  return apiOk({ homework: data || [] });
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "INVALID_FORMAT", 400);
  }

  const { rider_address, class_id, due_at, workout_config } = body;

  if (!rider_address || typeof rider_address !== "string") {
    return apiError("rider_address is required", "MISSING_FIELD", 400);
  }

  const { data, error } = await client
    .from("homework_assignments")
    .insert({
      instructor_address: payload.address,
      rider_address,
      class_id: class_id || null,
      due_at: due_at || null,
      workout_config: workout_config || null,
      status: "assigned",
    })
    .select()
    .single();

  if (error) {
    return apiError("Failed to assign homework", "INTERNAL_ERROR", 500, error.message);
  }

  return apiOk(data, 201);
}

export async function PUT(request: NextRequest) {
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
    return apiError("id query param is required", "MISSING_FIELD", 400);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "INVALID_FORMAT", 400);
  }

  const updateFields: Record<string, unknown> = {};
  if (body.status) updateFields.status = body.status;
  if (body.due_at !== undefined) updateFields.due_at = body.due_at;
  if (body.workout_config !== undefined) updateFields.workout_config = body.workout_config;
  if (body.completed_at !== undefined) updateFields.completed_at = body.completed_at;
  if (body.ride_id !== undefined) updateFields.ride_id = body.ride_id;

  const { data, error } = await client
    .from("homework_assignments")
    .update(updateFields)
    .eq("id", id)
    .or(`instructor_address.eq.${payload.address},rider_address.eq.${payload.address}`)
    .select()
    .single();

  if (error) {
    return apiError("Failed to update homework", "INTERNAL_ERROR", 500, error.message);
  }

  return apiOk(data);
}
