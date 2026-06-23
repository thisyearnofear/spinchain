import { NextRequest } from "next/server";
import { apiError, apiOk } from "@/app/lib/api/response";
import { getServerClient } from "@/app/lib/supabase/client";
import { verifySession } from "@/app/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Rider Roster API
 *
 * GET /api/instructor/roster — instructors see riders who attended their classes
 *                               with ride counts, last ride, avg metrics
 *
 * Returns: [{ address, display_name, ride_count, last_ride_at, avg_effort, avg_power,
 *             avg_heart_rate, classes_attended: string[] }]
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

  // Get all ride summaries for this instructor's classes
  const { data: rides, error } = await client
    .from("ride_summaries")
    .select("rider_address, class_id, class_name, completed_at, avg_effort, avg_heart_rate, avg_power")
    .eq("instructor", payload.address)
    .order("completed_at", { ascending: false });

  if (error) {
    return apiError("Failed to fetch roster", "INTERNAL_ERROR", 500, error.message);
  }

  if (!rides || rides.length === 0) {
    return apiOk({ roster: [] });
  }

  // Aggregate per rider
  const rosterMap = new Map<string, {
    address: string;
    ride_count: number;
    last_ride_at: string;
    avg_effort: number;
    avg_power: number;
    avg_heart_rate: number;
    classes_attended: Set<string>;
  }>();

  for (const ride of rides) {
    if (!ride.rider_address) continue;
    const existing = rosterMap.get(ride.rider_address);
    if (existing) {
      existing.ride_count++;
      existing.classes_attended.add(ride.class_id || "");
      // Keep last_ride_at as the most recent (rides are ordered desc)
    } else {
      rosterMap.set(ride.rider_address, {
        address: ride.rider_address,
        ride_count: 1,
        last_ride_at: ride.completed_at,
        avg_effort: ride.avg_effort || 0,
        avg_power: ride.avg_power || 0,
        avg_heart_rate: ride.avg_heart_rate || 0,
        classes_attended: new Set([ride.class_id || ""]),
      });
    }
  }

  // Compute averages across all rides per rider
  const riderRides = new Map<string, typeof rides>();
  for (const ride of rides) {
    if (!ride.rider_address) continue;
    if (!riderRides.has(ride.rider_address)) {
      riderRides.set(ride.rider_address, []);
    }
    riderRides.get(ride.rider_address)!.push(ride);
  }

  const roster = Array.from(rosterMap.values()).map((entry) => {
    const allRides = riderRides.get(entry.address) || [];
    const effortRides = allRides.filter((r) => r.avg_effort != null);
    const powerRides = allRides.filter((r) => r.avg_power != null);
    const hrRides = allRides.filter((r) => r.avg_heart_rate != null);

    return {
      address: entry.address,
      ride_count: entry.ride_count,
      last_ride_at: entry.last_ride_at,
      avg_effort: effortRides.length > 0
        ? Math.round(effortRides.reduce((s, r) => s + (r.avg_effort || 0), 0) / effortRides.length)
        : 0,
      avg_power: powerRides.length > 0
        ? Math.round(powerRides.reduce((s, r) => s + (r.avg_power || 0), 0) / powerRides.length)
        : 0,
      avg_heart_rate: hrRides.length > 0
        ? Math.round(hrRides.reduce((s, r) => s + (r.avg_heart_rate || 0), 0) / hrRides.length)
        : 0,
      classes_attended: Array.from(entry.classes_attended).filter(Boolean),
    };
  });

  // Sort by most recent ride first
  roster.sort((a, b) => new Date(b.last_ride_at).getTime() - new Date(a.last_ride_at).getTime());

  return apiOk({ roster });
}
