"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PrimaryNav } from "../../components/layout/nav";
import { getBadges, getClassLeaderboard, getPRs, getRideHistory, getStreakStats, type RideSummary } from "../../lib/analytics/ride-history";

function JourneyContent() {
  const searchParams = useSearchParams();
  const [rides] = useState<RideSummary[]>(() => getRideHistory());
  const isCompletedLanding = searchParams.get("completed") === "true";

  const streaks = useMemo(() => getStreakStats(rides), [rides]);
  const prs = useMemo(() => getPRs(rides), [rides]);
  const badges = useMemo(() => getBadges(rides), [rides]);
  const latestClassId = rides[0]?.classId ?? "";
  const leaderboard = useMemo(() => getClassLeaderboard(rides, latestClassId), [rides, latestClassId]);

  const recent = rides.slice(0, 8);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a2550,transparent_55%),radial-gradient(circle_at_80%_20%,#2a1d5a,transparent_40%)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-white/10 bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        {isCompletedLanding && (
          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-6 py-4 text-emerald-100">
            <p className="text-sm font-semibold">Ride complete 🎉</p>
            <p className="mt-1 text-sm text-emerald-100/80">Your latest ride has been added to your journey history.</p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-4">
          <StatCard label="Total Rides" value={rides.length.toString()} />
          <StatCard label="Daily Streak" value={`${streaks.daily} days`} />
          <StatCard label="Weekly Streak" value={`${streaks.weekly} weeks`} />
          <StatCard label="Best Effort" value={`${prs.bestEffort}/1000`} />
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-bold text-white">Trend Snapshot</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {recent.map((ride) => (
              <div key={ride.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs text-white/50">{new Date(ride.completedAt).toLocaleDateString()}</p>
                <p className="text-sm text-white/80">{ride.className}</p>
                <p className="text-lg font-semibold text-indigo-300">{ride.avgEffort}</p>
                <p className="text-xs text-white/50">Effort</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-bold text-white">Badges</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {badges.length === 0 ? (
                <span className="text-sm text-white/60">Complete more rides to unlock badges.</span>
              ) : (
                badges.map((badge) => (
                  <span key={badge} className="rounded-full border border-indigo-400/40 bg-indigo-500/20 px-3 py-1 text-xs text-indigo-200">
                    {badge}
                  </span>
                ))
              )}
            </div>
            <div className="mt-4 text-sm text-white/60">
              PR Power: {prs.bestPower}W • PR Duration: {Math.round(prs.bestDuration / 60)}m • PR SPIN: {prs.bestSpin.toFixed(1)}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-bold text-white">Class Leaderboard</h3>
            <p className="mt-1 text-xs text-white/50">Privacy-preserving ranking from your local ride summaries + proof metadata.</p>
            <div className="mt-4 space-y-2">
              {leaderboard.length === 0 ? (
                <p className="text-sm text-white/60">No leaderboard entries yet.</p>
              ) : (
                leaderboard.map((entry) => (
                  <div key={`${entry.rank}-${entry.riderLabel}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80">
                    <span>#{entry.rank} {entry.riderLabel}</span>
                    <span>{entry.effort} effort • {entry.verified ? "✓" : "~"} {entry.proofType}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-bold text-white">Ride History</h3>
          <div className="mt-4 space-y-3">
            {rides.length === 0 ? (
              <p className="text-sm text-white/60">No rides yet. Complete your first class to start your journey history.</p>
            ) : (
              rides.map((ride) => (
                <div key={ride.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{ride.className}</p>
                      <p className="text-xs text-white/50">{new Date(ride.completedAt).toLocaleString()} • {ride.instructor}</p>
                    </div>
                    <div className="text-right text-xs text-white/70">
                      <p>{ride.avgEffort}/1000 effort</p>
                      <p>{ride.spinEarned.toFixed(1)} SPIN</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-widest text-white/50">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function RiderJourneyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a2550,transparent_55%),radial-gradient(circle_at_80%_20%,#2a1d5a,transparent_40%)]" />}>
      <JourneyContent />
    </Suspense>
  );
}
