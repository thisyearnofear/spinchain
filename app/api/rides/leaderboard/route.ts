import { NextRequest, NextResponse } from "next/server";

const MOCK_CLASS_LEADERBOARD: Record<string, Array<{ riderLabel: string; effort: number; spin: number; verified: boolean; proofType: "zk-batch" | "yellow-stream" | "none" }>> = {
  default: [
    { riderLabel: "Rider-A7F2", effort: 842, spin: 84.2, verified: true, proofType: "zk-batch" },
    { riderLabel: "Rider-19DD", effort: 801, spin: 80.1, verified: true, proofType: "yellow-stream" },
    { riderLabel: "Rider-5BEE", effort: 768, spin: 76.8, verified: false, proofType: "none" },
  ],
};

export async function GET(req: NextRequest) {
  const classId = req.nextUrl.searchParams.get("classId") || "default";
  const rows = MOCK_CLASS_LEADERBOARD[classId] ?? MOCK_CLASS_LEADERBOARD.default;

  const entries = rows
    .slice()
    .sort((a, b) => b.effort - a.effort)
    .slice(0, 10)
    .map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));

  return NextResponse.json({
    entries,
    source: "remote",
    commitment: {
      epoch: Math.floor(Date.now() / (1000 * 60 * 30)),
      anchoredAt: Date.now(),
      txHash: "0x5f1a4d8d17fbbd3e24ce69a0d8a2738308ef17fa55d9e0a6f96f7dc7cd9b2f44",
    },
  });
}