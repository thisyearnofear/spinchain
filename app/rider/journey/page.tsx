"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PrimaryNav } from "../../components/layout/nav";
import {
  getBadges,
  getLeaderboardSnapshot,
  getPRs,
  getRetentionSignals,
  getRideHistory,
  processRideSyncQueue,
  type LeaderboardSnapshot,
  type RideSummary,
} from "../../lib/analytics/ride-history";

import { Cloud, ExternalLink, ShieldCheck } from "lucide-react";

function JourneyContent() {
  const searchParams = useSearchParams();
  const [rides] = useState<RideSummary[]>(() => getRideHistory());
  const [leaderboard, setLeaderboard] = useState<LeaderboardSnapshot | null>(
    null,
  );
  const isCompletedLanding = searchParams.get("completed") === "true";

  const retention = useMemo(() => getRetentionSignals(rides), [rides]);
  const prs = useMemo(() => getPRs(rides), [rides]);
  const badges = useMemo(() => getBadges(rides), [rides]);
  const latestClassId = rides[0]?.classId ?? "";
  useEffect(() => {
    void processRideSyncQueue();
    void getLeaderboardSnapshot(rides, latestClassId).then(setLeaderboard);
  }, [rides, latestClassId]);

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
            <p className="mt-1 text-sm text-emerald-100/80">
              Your latest ride has been added to your journey history.
            </p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-4">
          <StatCard label="Total Rides" value={rides.length.toString()} />
          <StatCard
            label="Daily Streak"
            value={`${retention.streaks.daily} days`}
          />
          <StatCard
            label="Weekly Streak"
            value={`${retention.streaks.weekly} weeks`}
          />
          <StatCard label="Best Effort" value={`${prs.bestEffort}/1000`} />
        </div>

        <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-6">
          <h3 className="text-lg font-bold text-white">Weekly Goal</h3>
          <p className="mt-2 text-sm text-cyan-100/90">
            {retention.weeklyGoal.completedRides}/
            {retention.weeklyGoal.targetRides} rides completed this week.{" "}
            {retention.weeklyGoal.remainingRides > 0
              ? `${retention.weeklyGoal.remainingRides} to go.`
              : "Goal complete — momentum unlocked."}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-bold text-white">Trend Snapshot</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {recent.map((ride) => (
              <div
                key={ride.id}
                className="rounded-xl border border-white/10 bg-black/20 p-3"
              >
                <p className="text-xs text-white/50">
                  {new Date(ride.completedAt).toLocaleDateString()}
                </p>
                <p className="text-sm text-white/80">{ride.className}</p>
                <p className="text-lg font-semibold text-indigo-300">
                  {ride.avgEffort}
                </p>
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
                <span className="text-sm text-white/60">
                  Complete more rides to unlock badges.
                </span>
              ) : (
                badges.map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border border-indigo-400/40 bg-indigo-500/20 px-3 py-1 text-xs text-indigo-200"
                  >
                    {badge}
                  </span>
                ))
              )}
            </div>
            <div className="mt-4 text-sm text-white/60">
              PR Power: {prs.bestPower}W • PR Duration:{" "}
              {Math.round(prs.bestDuration / 60)}m • PR SPIN:{" "}
              {prs.bestSpin.toFixed(1)}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-bold text-white">Class Leaderboard</h3>
            <p className="mt-1 text-xs text-white/50">
              {leaderboard?.source === "remote"
                ? "Off-chain indexed class rankings, periodically anchored on-chain for verification."
                : "Showing local fallback while waiting for relay/index sync."}
            </p>
            {leaderboard?.commitment.epoch ? (
              <p className="mt-1 text-[11px] text-white/50">
                Commitment epoch #{leaderboard.commitment.epoch}
                {leaderboard.commitment.txHash
                  ? ` • ${leaderboard.commitment.txHash.slice(0, 8)}...`
                  : ""}
              </p>
            ) : null}
            <div className="mt-4 space-y-2">
              {(leaderboard?.entries.length ?? 0) === 0 ? (
                <p className="text-sm text-white/60">
                  No leaderboard entries yet.
                </p>
              ) : (
                leaderboard?.entries.map((entry) => (
                  <div
                    key={`${entry.rank}-${entry.riderLabel}`}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80"
                  >
                    <span>
                      #{entry.rank} {entry.riderLabel}
                    </span>
                    <span>
                      {entry.effort} effort • {entry.verified ? "✓" : "~"}{" "}
                      {entry.proofType}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Cloud className="w-5 h-5 text-indigo-400" />
                Decentralized Walrus Feed
              </h3>
              <p className="text-xs text-white/40 italic">
                Permanently anchored session summaries.
              </p>
            </div>
            <ShieldCheck className="w-5 h-5 text-emerald-400 opacity-50" />
          </div>

          <div className="space-y-3">
            {[
              {
                id: "1",
                date: "2024-03-20",
                class: "Neon HIIT",
                blobId: "walrus-blob-823x...",
                status: "anchored",
              },
              {
                id: "2",
                date: "2024-03-18",
                class: "Alpine Climb",
                blobId: "walrus-blob-192y...",
                status: "anchored",
              },
            ].map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 rounded-2xl bg-black/40 border border-white/5 hover:border-white/10 transition-all group"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-white/90">
                    {item.class}
                  </span>
                  <span className="text-[10px] font-mono text-white/30 uppercase tracking-tighter">
                    {item.blobId}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                    {item.status}
                  </span>
                  <ExternalLink className="w-4 h-4 text-white/20 group-hover:text-indigo-400 transition-colors cursor-pointer" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-bold text-white">Ride History</h3>
          {retention.unlockedBadges.length > 0 && (
            <p className="mt-1 text-xs text-white/50">
              Latest unlock: {retention.unlockedBadges.at(-1)?.name}
            </p>
          )}
          <div className="mt-4 space-y-3">
            {rides.length === 0 ? (
              <p className="text-sm text-white/60">
                No rides yet. Complete your first class to start your journey
                history.
              </p>
            ) : (
              rides.map((ride) => (
                <div
                  key={ride.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">
                        {ride.className}
                      </p>
                      <p className="text-xs text-white/50">
                        {new Date(ride.completedAt).toLocaleString()} •{" "}
                        {ride.instructor}
                      </p>
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
    <Suspense
      fallback={
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a2550,transparent_55%),radial-gradient(circle_at_80%_20%,#2a1d5a,transparent_40%)]" />
      }
    >
      <JourneyContent />
    </Suspense>
  );
}
