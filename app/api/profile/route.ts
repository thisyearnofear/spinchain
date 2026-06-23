import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/app/lib/api/response";
import { getServerClient } from "@/app/lib/supabase/client";
import { verifySession } from "@/app/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Rider Profile API
 *
 * GET  /api/profile — get authenticated rider's profile
 * PUT  /api/profile — update profile (merges with existing)
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

  const { data, error } = await client
    .from("rider_profiles")
    .select("*")
    .eq("address", payload.address)
    .single();

  if (error && error.code !== "PGRST116") {
    return apiError("Failed to fetch profile", "INTERNAL_ERROR", 500, error.message);
  }

  return apiOk({ profile: data || null });
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "INVALID_FORMAT", 400);
  }

  // Whitelist updatable fields
  const allowedFields = [
    "goal", "experience", "frequency", "motivation", "coach_personality",
    "display_name", "ftp", "max_hr", "resting_hr", "weight_kg", "height_cm",
    "injuries", "training_zones",
  ];

  const update: Record<string, unknown> = { address: payload.address };
  for (const key of allowedFields) {
    if (key in body) {
      update[key] = body[key];
    }
  }

  const { data, error } = await client
    .from("rider_profiles")
    .upsert(update, { onConflict: "address" })
    .select()
    .single();

  if (error) {
    return apiError("Failed to update profile", "INTERNAL_ERROR", 500, error.message);
  }

  return apiOk({ profile: data });
}
