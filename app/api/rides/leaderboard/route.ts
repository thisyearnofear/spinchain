import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard, hasLeaderboardEntries } from "@/app/lib/api/leaderboard-store";

export const dynamic = "force-dynamic";

type PrivacyTier = "high" | "medium" | "low";

export interface LeaderboardEntry {
  rank: number;
  riderId: string;
  effortScore?: number;
  durationSec?: number;
  completedAt: number;
  privacyTier: PrivacyTier;
}

export interface LeaderboardResponse {
  classId: string;
  entries: LeaderboardEntry[];
  source: "walrus" | "not_configured";
  privacyTier: PrivacyTier;
  message?: string;
}

export async function GET(req: NextRequest): Promise<NextResponse<LeaderboardResponse>> {
  const classId = req.nextUrl.searchParams.get("classId") || "default";
  const privacyTier = (req.nextUrl.searchParams.get("privacyTier") ?? "high") as PrivacyTier;

  const entries = getLeaderboard(classId);
  const hasEntries = hasLeaderboardEntries(classId);

  return NextResponse.json({
    classId,
    entries,
    source: hasEntries ? "walrus" : "not_configured",
    privacyTier,
    message: hasEntries
      ? undefined
      : "No rides synced for this class yet. Complete and sync a ride to appear here.",
  });
}
