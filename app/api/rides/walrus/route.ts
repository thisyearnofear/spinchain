import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/app/lib/api/response";

export const dynamic = "force-dynamic";

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
const MAX_ENTRIES = 10000;

/**
 * POST /api/rides/walrus — register a Walrus blobId for a ride
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rideId, riderId, blobId, className, completedAt } = body;

    if (!rideId || typeof rideId !== "string") {
      return apiError("Missing required field: rideId", "MISSING_FIELD", 400);
    }
    if (!blobId || typeof blobId !== "string") {
      return apiError("Missing required field: blobId", "MISSING_FIELD", 400);
    }

    const entry: WalrusRideEntry = {
      rideId,
      riderId: typeof riderId === "string" ? riderId : "anon",
      blobId,
      className: typeof className === "string" ? className : "Unknown",
      completedAt: typeof completedAt === "number" ? completedAt : Date.now(),
      registeredAt: Date.now(),
    };

    walrusIndex.set(rideId, entry);

    // Evict oldest if over limit
    if (walrusIndex.size > MAX_ENTRIES) {
      const oldest = [...walrusIndex.entries()]
        .sort(([, a], [, b]) => a.registeredAt - b.registeredAt)
        .slice(0, walrusIndex.size - MAX_ENTRIES);
      for (const [key] of oldest) walrusIndex.delete(key);
    }

    return NextResponse.json({ success: true, rideId, blobId });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Failed to register blob",
      "INTERNAL_ERROR",
      500,
    );
  }
}

/**
 * GET /api/rides/walrus — look up blobId by rideId, or list entries for a rider
 */
export async function GET(req: NextRequest) {
  const rideId = req.nextUrl.searchParams.get("rideId");
  const riderId = req.nextUrl.searchParams.get("riderId");

  // Single ride lookup
  if (rideId) {
    const entry = walrusIndex.get(rideId);
    if (!entry) {
      return NextResponse.json({ blobId: null });
    }
    return NextResponse.json({
      blobId: entry.blobId,
      className: entry.className,
      completedAt: entry.completedAt,
    });
  }

  // List by rider (or all)
  let entries = [...walrusIndex.values()];
  if (riderId) {
    entries = entries.filter((e) => e.riderId === riderId);
  }

  entries.sort((a, b) => b.completedAt - a.completedAt);

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
