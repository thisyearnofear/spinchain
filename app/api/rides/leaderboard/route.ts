import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const classId = req.nextUrl.searchParams.get("classId") || "default";
  return NextResponse.json(
    {
      error: "Remote leaderboard unavailable",
      message: `Remote leaderboard for class '${classId}' is not configured in this deployment.`,
    },
    { status: 503 }
  );
}
