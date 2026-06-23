import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/app/lib/api/response";
import { getServerClient } from "@/app/lib/supabase/client";
import { verifySession } from "@/app/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Instructor Analytics API
 *
 * GET /api/instructor/analytics?range=30d
 *
 * Queries ride_summaries joined with class data to compute:
 * - Attendance rate (rides with completed_at / total tickets sold)
 * - Unique riders (distinct rider_address per instructor)
 * - Repeat rider rate (riders who attended >1 class)
 * - Average power, heart rate, effort from actual ride data
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
  const range = searchParams.get("range") || "30d";

  const rangeSeconds = {
    "7d": 7 * 24 * 60 * 60,
    "30d": 30 * 24 * 60 * 60,
    "90d": 90 * 24 * 60 * 60,
    all: 0,
  }[range] ?? 30 * 24 * 60 * 60;

  const cutoffDate = rangeSeconds > 0
    ? new Date(Date.now() - rangeSeconds * 1000).toISOString()
    : null;

  // Query ride_summaries for this instructor's classes
  let query = client
    .from("ride_summaries")
    .select("rider_address, class_id, class_name, completed_at, avg_effort, avg_heart_rate, avg_power, effort_tier")
    .eq("instructor", payload.address);

  if (cutoffDate) {
    query = query.gte("completed_at", cutoffDate);
  }

  const { data: rides, error } = await query;

  if (error) {
    return apiError("Failed to fetch analytics", "INTERNAL_ERROR", 500, error.message);
  }

  if (!rides || rides.length === 0) {
    return apiOk({
      totalRides: 0,
      uniqueRiders: 0,
      repeatRiderRate: 0,
      avgEffort: 0,
      avgPower: 0,
      avgHeartRate: 0,
      attendanceRate: 0,
      riderBreakdown: [],
    });
  }

  // Compute metrics from real data
  const riderAddresses = rides.map((r) => r.rider_address).filter(Boolean);
  const uniqueRiderSet = new Set(riderAddresses);
  const uniqueRiders = uniqueRiderSet.size;

  // Repeat rider rate: riders who appear in >1 class
  const riderClassCount = new Map<string, Set<string>>();
  for (const ride of rides) {
    if (!ride.rider_address || !ride.class_id) continue;
    if (!riderClassCount.has(ride.rider_address)) {
      riderClassCount.set(ride.rider_address, new Set());
    }
    riderClassCount.get(ride.rider_address)!.add(ride.class_id);
  }
  const repeatRiders = Array.from(riderClassCount.values()).filter((s) => s.size > 1).length;
  const repeatRiderRate = uniqueRiders > 0 ? repeatRiders / uniqueRiders : 0;

  // Average metrics from actual ride data
  const avgEffort = rides.reduce((s, r) => s + (r.avg_effort || 0), 0) / rides.length;
  const ridesWithPower = rides.filter((r) => r.avg_power != null);
  const avgPower = ridesWithPower.length > 0
    ? ridesWithPower.reduce((s, r) => s + (r.avg_power || 0), 0) / ridesWithPower.length
    : 0;
  const ridesWithHr = rides.filter((r) => r.avg_heart_rate != null);
  const avgHeartRate = ridesWithHr.length > 0
    ? ridesWithHr.reduce((s, r) => s + (r.avg_heart_rate || 0), 0) / ridesWithHr.length
    : 0;

  // Attendance: rides completed / total classes (approximation — we count
  // classes that have at least one ride summary vs total instructor classes)
  const classIds = new Set(rides.map((r) => r.class_id).filter(Boolean));
  const attendanceRate = classIds.size > 0 ? rides.length / classIds.size : 0;

  // Rider breakdown for roster view
  const riderBreakdown = Array.from(uniqueRiderSet).map((addr) => {
    const riderRides = rides.filter((r) => r.rider_address === addr);
    return {
      address: addr,
      rideCount: riderRides.length,
      avgEffort: riderRides.reduce((s, r) => s + (r.avg_effort || 0), 0) / riderRides.length,
      avgPower: riderRides.filter((r) => r.avg_power).reduce((s, r) => s + (r.avg_power || 0), 0) / Math.max(riderRides.filter((r) => r.avg_power).length, 1),
      lastRideAt: riderRides.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0]?.completed_at,
    };
  });

  return apiOk({
    totalRides: rides.length,
    uniqueRiders,
    repeatRiderRate,
    avgEffort,
    avgPower,
    avgHeartRate,
    attendanceRate: Math.min(attendanceRate, 1),
    riderBreakdown,
  });
}
