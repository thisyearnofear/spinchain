"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PrimaryNav } from "../../components/layout/nav";
import {
  getBadges,
  getEffortTier,
  getLeaderboardSnapshot,
  getPRs,
  getRideRewardStatus,
  getRetentionSignals,
  getRideHistory,
  saveRideSummary,
  processRideSyncQueue,
  type LeaderboardSnapshot,
  type RideSummary,
} from "../../lib/analytics/ride-history";

import {
  Cloud,
  ExternalLink,
  ShieldCheck,
  Wallet,
  Coins,
  Bike,
  Route,
} from "lucide-react";
import { getWalrusFeed, retrieveRideSummaryFromWalrus, type WalrusFeedEntry } from "../../lib/walrus/ride-persistence";
import { useSupabaseSync } from "../../hooks/common/use-supabase-sync";
import { WALRUS_AGGREGATOR_URL } from "../../lib/walrus/types";
import { useAccount } from "wagmi";
import Link from "next/link";
import {
  EffortTrendChart,
  CalendarHeatmap,
  WeeklyVolumeChart,
  ZoneDistributionChart,
} from "../../components/features/rider/ride-charts";
import { DataOwnershipDashboard } from "../../components/features/rider/data-ownership-dashboard";
import { RiderHomeworkCard } from "../../components/features/rider/rider-homework-card";
import { RideAnalysisCard } from "../../components/features/rider/ride-analysis-card";
import { TrainingPlanCard } from "../../components/features/rider/training-plan-card";
import { useProfileSyncEffect } from "../../hooks/common/use-profile-sync";

function JourneyContent() {
  const searchParams = useSearchParams();
  const [rides, setRides] = useState<RideSummary[]>(() => getRideHistory());
  const [leaderboard, setLeaderboard] = useState<LeaderboardSnapshot | null>(
    null,
  );
  const [walrusFeed, setWalrusFeed] = useState<WalrusFeedEntry[]>([]);
  const { address } = useAccount();
  const isCompletedLanding = searchParams.get("completed") === "true";

  useProfileSyncEffect();
  useSupabaseSync();

  const retention = useMemo(() => getRetentionSignals(rides), [rides]);
  const prs = useMemo(() => getPRs(rides), [rides]);
  const badges = useMemo(() => getBadges(rides), [rides]);
  const latestClassId = rides[0]?.classId ?? "";

  // Derive protocol tier from real effort data
  const { tierLabel, tierColor, tierDescription } = useMemo(() => {
    if (rides.length === 0) return { tierLabel: "—", tierColor: "#6b7280", tierDescription: "Complete rides to earn a tier." };
    const avgEffort = rides.reduce((s, r) => s + r.avgEffort, 0) / rides.length;
    const tier = getEffortTier(avgEffort);
    return { tierLabel: tier.displayLabel, tierColor: tier.color, tierDescription: `Avg effort ${Math.round(avgEffort)}/1000 across ${rides.length} rides.` };
  }, [rides]);

  // Derive active multiplier from real streak data
  const multiplier = useMemo(() => {
    const streak = retention.streaks.daily;
    if (streak >= 7) return { label: "1.5x", description: `${streak}-day streak bonus active.` };
    if (streak >= 3) return { label: "1.2x", description: `${streak}-day streak bonus active.` };
    if (streak >= 1) return { label: "1.0x", description: "Ride 3+ days in a row to unlock a streak bonus." };
    return { label: "—", description: "Start a streak by riding 3+ days in a row." };
  }, [retention.streaks.daily]);
  useEffect(() => {
    void processRideSyncQueue().then(() => {
      setRides(getRideHistory());
    });
  }, []);

  useEffect(() => {
    void getLeaderboardSnapshot(rides, latestClassId).then(setLeaderboard);
  }, [rides, latestClassId]);

  useEffect(() => {
    getWalrusFeed(address).then(setWalrusFeed).catch(() => {});
  }, [address]);

  // Walrus recovery: if localStorage is empty but Walrus has entries (new device),
  // pull full RideSummary for each blob and seed localStorage.
  useEffect(() => {
    if (rides.length > 0 || walrusFeed.length === 0) return;
    const recover = async () => {
      let recovered = false;
      for (const entry of walrusFeed) {
        const summary = await retrieveRideSummaryFromWalrus(entry.rideId);
        if (summary) {
          saveRideSummary(summary);
          recovered = true;
        }
      }
      if (recovered) setRides(getRideHistory());
    };
    void recover();
  }, [rides.length, walrusFeed]);

  useEffect(() => {
    const handleStorage = () => setRides(getRideHistory());
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a2550,transparent_55%),radial-gradient(circle_at_80%_20%,#2a1d5a,transparent_40%)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-white/10 bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        {isCompletedLanding && (
          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-6 py-4 text-emerald-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Ride complete 🎉</p>
                <p className="mt-1 text-sm text-emerald-100/80">
                  Your latest ride has been added to your journey history.
                </p>
              </div>
              <Link
                href="/rider"
                className="flex items-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/30 transition-all whitespace-nowrap"
              >
                <Bike className="w-4 h-4" />
                Ride Again
              </Link>
            </div>
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

        {/* Sui Wallet Health & SPIN Management */}
        <div className="rounded-[2.5rem] border border-yellow-500/20 bg-yellow-500/5 p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Wallet className="w-32 h-32 text-yellow-500 rotate-12" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-2xl bg-yellow-500/20 border border-yellow-500/30">
                <Coins className="w-5 h-5 text-yellow-500" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-xl font-black text-white tracking-tight">
                  Sui Wallet Health
                </h3>
                <p className="text-xs text-yellow-500/60 font-bold uppercase tracking-widest">
                  Protocol Assets
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-5 rounded-3xl bg-black/40 border border-white/5">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] block mb-2">
                  Total SPIN Earned
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white tracking-tighter">
                    {rides.reduce((sum, r) => sum + r.spinEarned, 0).toFixed(1)}
                  </span>
                  <span className="text-xs font-bold text-yellow-500 uppercase">
                    SPIN
                  </span>
                </div>
                <p className="mt-4 text-[10px] text-white/40 font-medium">
                  Rewards are claimed automatically after each ride. No separate claim action needed.
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-black/40 border border-white/5">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] block mb-2">
                  Protocol Tier
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black tracking-tighter
                    " style={{ color: tierColor }}>
                    {tierLabel}
                  </span>
                </div>
                <p className="mt-2 text-[10px] text-white/40 font-medium">
                  {tierDescription}
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-black/40 border border-white/5">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] block mb-2">
                  Active Multiplier
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-emerald-400 tracking-tighter">
                    {multiplier.label}
                  </span>
                </div>
                <p className="mt-2 text-[10px] text-white/40 font-medium">
                  {multiplier.description}
                </p>
              </div>
            </div>
          </div>
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

        {/* Effort Trend Chart */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-bold text-white">Effort Trend</h2>
          <p className="mt-1 text-xs text-white/40">Your effort score over recent rides</p>
          <div className="mt-4">
            <EffortTrendChart rides={rides} />
          </div>
        </div>

        {/* Calendar Heatmap */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-bold text-white">Ride Calendar</h2>
          <p className="mt-1 text-xs text-white/40">Your consistency over the last 12 weeks</p>
          <div className="mt-4">
            <CalendarHeatmap rides={rides} />
          </div>
        </div>

        {/* Weekly Volume + Zone Distribution */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-bold text-white">Weekly Volume</h2>
            <p className="mt-1 text-xs text-white/40">Rides per week, stacked by effort tier</p>
            <div className="mt-4">
              <WeeklyVolumeChart rides={rides} />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-bold text-white">Zone Distribution</h2>
            <p className="mt-1 text-xs text-white/40">Time spent in each heart rate zone</p>
            <div className="mt-4">
              <ZoneDistributionChart rides={rides} />
            </div>
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
            {walrusFeed.length === 0 ? (
              <p className="text-sm text-white/50 italic">
                No sessions anchored to Walrus yet. Complete a ride to persist your first summary.
              </p>
            ) : (
              walrusFeed.map((item) => (
                <div
                  key={item.rideId}
                  className="flex items-center justify-between p-4 rounded-2xl bg-black/40 border border-white/5 hover:border-white/10 transition-all group"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-white/90">
                      {item.className}
                    </span>
                    <span className="text-[10px] font-mono text-white/30 uppercase tracking-tighter">
                      {item.blobId.length > 20
                        ? `${item.blobId.slice(0, 10)}…${item.blobId.slice(-8)}`
                        : item.blobId}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] text-white/40">
                      {new Date(item.completedAt).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                      anchored
                    </span>
                    <a
                      href={`${WALRUS_AGGREGATOR_URL}/v1/${item.blobId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-4 h-4 text-white/20 group-hover:text-indigo-400 transition-colors cursor-pointer" />
                    </a>
                  </div>
                </div>
              ))
            )}
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
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="relative mb-4">
                  <div className="absolute inset-0 blur-2xl opacity-20 bg-indigo-500 rounded-full" />
                  <div className="relative w-14 h-14 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">
                    <Route className="w-6 h-6 text-indigo-400" strokeWidth={1.5} />
                  </div>
                </div>
                <p className="text-sm font-bold text-white/80">No rides yet</p>
                <p className="text-xs text-white/40 mt-1 max-w-xs">
                  Complete your first class to start building your journey history with telemetry, badges, and rewards.
                </p>
                <Link
                  href="/rider"
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition-[transform,background-color] duration-150 active:scale-95 hover:bg-indigo-500/30"
                >
                  <Bike className="w-3.5 h-3.5" />
                  Browse Classes
                </Link>
              </div>
            ) : (
              rides.map((ride) => (
                <div
                  key={ride.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white">
                        {ride.className}
                      </p>
                      <p className="text-xs text-white/50">
                        {new Date(ride.completedAt).toLocaleString()} •{" "}
                        {ride.instructor}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        <span
                          className={`rounded-full px-2 py-1 font-semibold ${getStatusToneClasses(getRideRewardStatus(ride).tone)}`}
                        >
                          {getRideRewardStatus(ride).label}
                        </span>
                        {ride.proof.mode !== "none" ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-white/60">
                            {ride.proof.mode}
                          </span>
                        ) : null}
                        {ride.proof.verifiedScore ? (
                          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-cyan-200">
                            {ride.proof.verifiedScore}/1000 verified
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right text-xs text-white/70">
                      <p>{ride.avgEffort}/1000 effort</p>
                      <p>{ride.spinEarned.toFixed(1)} SPIN</p>
                      <p className="mt-2 text-white/40">{ride.sync.status.replace("_", " ")}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Ride Analysis */}
        <RideAnalysisCard />

        {/* AI Training Plan */}
        <TrainingPlanCard />

        {/* Homework from coach */}
        <RiderHomeworkCard />

        {/* Data Ownership & Preferences */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white tracking-tight">
              Settings
            </h2>
          </div>
          <DataOwnershipDashboard />
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

function getStatusToneClasses(
  tone: "neutral" | "cyan" | "emerald" | "amber" | "red",
) {
  switch (tone) {
    case "cyan":
      return "border border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
    case "emerald":
      return "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "amber":
      return "border border-amber-500/30 bg-amber-500/10 text-amber-200";
    case "red":
      return "border border-red-500/30 bg-red-500/10 text-red-200";
    default:
      return "border border-white/10 bg-white/5 text-white/60";
  }
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
