import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/app/lib/api/response";
import { getServerClient } from "@/app/lib/supabase/client";
import { verifySession } from "@/app/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Gym Registry & Bike Calibration API
 *
 * GET  /api/gyms                — list all gyms
 * GET  /api/gyms?id=<uuid>      — single gym with bike calibrations
 * POST /api/gyms                — create a gym (auth required)
 * POST /api/gyms?gymId=<uuid>&bike=<id> — add/update bike calibration
 */

async function getAuthPayload(request: NextRequest) {
  const token = request.cookies.get("spinchain-session")?.value
    || request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifySession(token);
}

export async function GET(request: NextRequest) {
  const client = getServerClient();
  if (!client) {
    return apiError("Database not configured", "NOT_CONFIGURED", 503);
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const { data: gym, error } = await client
      .from("gyms")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return apiError("Gym not found", "FORBIDDEN", 404, error.message);
    }

    const { data: bikes } = await client
      .from("bike_calibrations")
      .select("*")
      .eq("gym_id", id);

    return apiOk({ ...gym, bikes: bikes || [] });
  }

  const { data: gyms, error } = await client
    .from("gyms")
    .select("*")
    .order("name");

  if (error) {
    return apiError("Failed to fetch gyms", "INTERNAL_ERROR", 500, error.message);
  }

  return apiOk({ gyms: gyms || [] });
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

  const { searchParams } = new URL(request.url);
  const gymId = searchParams.get("gymId");
  const bikeId = searchParams.get("bike");

  // Bike calibration add/update
  if (gymId && bikeId) {
    const { data, error } = await client
      .from("bike_calibrations")
      .upsert({
        gym_id: gymId,
        bike_id: bikeId,
        power_offset: body.power_offset ?? 0,
        power_scale: body.power_scale ?? 1.0,
        hr_offset: body.hr_offset ?? 0,
        hr_scale: body.hr_scale ?? 1.0,
        calibrated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return apiError("Failed to save bike calibration", "INTERNAL_ERROR", 500, error.message);
    }

    return apiOk(data);
  }

  // Create gym
  const { name, location, brand, power_offset, power_scale, hr_offset, hr_scale } = body;

  if (!name || typeof name !== "string") {
    return apiError("name is required", "MISSING_FIELD", 400);
  }

  const { data, error } = await client
    .from("gyms")
    .insert({
      name,
      location: location || null,
      brand: brand || "generic",
      power_offset: power_offset ?? 0,
      power_scale: power_scale ?? 1.0,
      hr_offset: hr_offset ?? 0,
      hr_scale: hr_scale ?? 1.0,
      created_by: payload.address,
    })
    .select()
    .single();

  if (error) {
    return apiError("Failed to create gym", "INTERNAL_ERROR", 500, error.message);
  }

  return apiOk(data);
}
