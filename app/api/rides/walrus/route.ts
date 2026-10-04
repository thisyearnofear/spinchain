import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/app/lib/api/response";
import { verifySession } from "@/app/lib/auth/session";

export const dynamic = "force-dynamic";

async function getAuthPayload(request: NextRequest) {
  const token = request.cookies.get("spinchain-session")?.value
    || request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifySession(token);
}

interface WalrusRideEntry {
  rideId: string;
  riderId: string;
  blobId: string;
  className: string;
  completedAt: number;
  registeredAt: number;
}

// In-memory store (production: replace with DB)
const walrusIndex = new Map<string, WalrusRideEntry>();

/**
 * POST /api/rides/walrus — register a Walrus blobId for a ride
 */
export async function POST(_req: NextRequest) {
  return apiError("Public ride publishing is disabled", "NOT_IMPLEMENTED", 501);
}

/**
 * GET /api/rides/walrus — look up blobId by rideId, or list entries for a rider
 */
export async function GET(req: NextRequest) {
  const payload = await getAuthPayload(req);
  if (!payload) {
    return apiError("Authentication required", "FORBIDDEN", 401);
  }

  const rideId = req.nextUrl.searchParams.get("rideId");
  const riderId = req.nextUrl.searchParams.get("riderId");

  if (riderId && riderId.toLowerCase() !== payload.address.toLowerCase()) {
    return apiError("riderId does not match session", "FORBIDDEN", 403);
  }

  // Single ride lookup
  if (rideId) {
    const entry = walrusIndex.get(rideId);
    if (!entry || entry.riderId.toLowerCase() !== payload.address.toLowerCase()) {
      return apiError("Not found", "FORBIDDEN", 404);
    }
    return NextResponse.json({
      blobId: entry.blobId,
      className: entry.className,
      completedAt: entry.completedAt,
    });
  }

  // List by rider
  const entries = [...walrusIndex.values()]
    .filter((e) => e.riderId.toLowerCase() === payload.address.toLowerCase())
    .sort((a, b) => b.completedAt - a.completedAt);

  return NextResponse.json({
    entries: entries.slice(0, 50).map((e) => ({
      rideId: e.rideId,
      blobId: e.blobId,
      className: e.className,
      completedAt: e.completedAt,
    })),
    total: entries.length,
  });
}
