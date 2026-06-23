import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/app/lib/api/response";
import { getServerClient } from "@/app/lib/supabase/client";
import { verifySession } from "@/app/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Progress Delta API
 *
 * GET /api/progress/delta?rider=0x...&instructor=0x...
 *
 * Compares a rider's metrics before and after their most recent class
 * with a given instructor. Returns:
 *   { first_ride_at, last_ride_at, before: {avg_power, avg_effort, avg_hr},
 *     after: {avg_power, avg_effort, avg_hr}, deltas: {power, effort, hr} }
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
  const rider = searchParams.get("rider");
  const instructor = searchParams.get("instructor");

  if (!rider) {
    return apiError("rider query param is required", "MISSING_FIELD", 400);
  }

  // Access control: rider can see own progress, instructor can see their riders
  if (rider !== payload.address && instructor !== payload.address) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  // Get the rider's rides for this instructor, ordered by time
  let query = client
    .from("ride_summaries")
    .select("completed_at, avg_power, avg_heart_rate, avg_effort, class_id, class_name")
    .eq("rider_address", rider)
    .order("completed_at", { ascending: true });

  if (instructor) {
    query = query.eq("instructor", instructor);
  }

  const { data: rides, error } = await query.limit(200);

  if (error) {
    return apiError("Failed to fetch progress", "INTERNAL_ERROR", 500, error.message);
  }

  if (!rides || rides.length === 0) {
    return apiOk({
      first_ride_at: null,
      last_ride_at: null,
      before: null,
      after: null,
      deltas: null,
      total_rides: 0,
    });
  }

  if (rides.length === 1) {
    return apiOk({
      first_ride_at: rides[0].completed_at,
      last_ride_at: rides[0].completed_at,
      before: null,
      after: {
        avg_power: rides[0].avg_power || 0,
        avg_heart_rate: rides[0].avg_heart_rate || 0,
        avg_effort: rides[0].avg_effort || 0,
      },
      deltas: null,
      total_rides: 1,
    });
  }

  // Split into first half (before) and last half (after)
  const midpoint = Math.floor(rides.length / 2);
  const beforeRides = rides.slice(0, midpoint);
  const afterRides = rides.slice(midpoint);

  const avg = (arr: typeof rides, key: "avg_power" | "avg_heart_rate" | "avg_effort") => {
    const filtered = arr.filter((r) => r[key] != null && r[key] > 0);
    if (filtered.length === 0) return 0;
    return Math.round(filtered.reduce((s, r) => s + (r[key] || 0), 0) / filtered.length);
  };

  const before = {
    avg_power: avg(beforeRides, "avg_power"),
    avg_heart_rate: avg(beforeRides, "avg_heart_rate"),
    avg_effort: avg(beforeRides, "avg_effort"),
  };

  const after = {
    avg_power: avg(afterRides, "avg_power"),
    avg_heart_rate: avg(afterRides, "avg_heart_rate"),
    avg_effort: avg(afterRides, "avg_effort"),
  };

  const deltas = {
    power: after.avg_power - before.avg_power,
    effort: after.avg_effort - before.avg_effort,
    heart_rate: after.avg_heart_rate - before.avg_heart_rate,
  };

  return apiOk({
    first_ride_at: rides[0].completed_at,
    last_ride_at: rides[rides.length - 1].completed_at,
    before,
    after,
    deltas,
    total_rides: rides.length,
  });
}
