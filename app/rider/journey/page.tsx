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
  getRideAnchoringStatus,
  getRetentionSignals,
  getRideHistory,
  saveRideSummary,
  processRideSyncQueue,
  type LeaderboardSnapshot,
  type RideSummary,
} from "../../lib/analytics/ride-history";

import {
  Check,
  Cloud,
  ShieldCheck,
  Wallet,
  Coins,
  Bike,
  Route,
  ChevronDown,
} from "lucide-react";
import { getWalrusFeed, retrieveRideSummaryFromWalrus, type WalrusFeedEntry } from "../../lib/walrus/ride-persistence";
import { useSupabaseSync, RIDE_HISTORY_UPDATED_EVENT } from "../../hooks/common/use-supabase-sync";
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
import { chipToneClasses } from "../../lib/ui/chip-tone";
import { RideAnalysisCard } from "../../components/features/rider/ride-analysis-card";
import { TrainingPlanCard } from "../../components/features/rider/training-plan-card";
import { CoachArcCard } from "../../components/features/rider/coach-arc-card";
import { useProfileSyncEffect } from "../../hooks/common/use-profile-sync";
import { composeCoachArc } from "../../lib/journey/coach-arc";
import { listCachedCoachMemories } from "../../lib/walrus/coach-memory";
import { isLegacyRewardClaimsEnabled } from "../../lib/rewards/legacy-policy";
import { RedeemPilotChip } from "../../components/features/rider/redeem-pilot-chip";
import { useRiderProfile, mapCoachPersonalityToEngine } from "../../stores/rider-profile-store";
import { getTheme } from "../../lib/themes/registry";
import { experienceManager } from "../../lib/experience-level";
import type { CharacterState } from "../../lib/character-state";

// A small accent detail tinted by the coach arc's state (matches the
// state-chip palette in CoachArcCard). A tint, not an effect.
const STATE_ACCENT: Record<CharacterState, string> = {
  idle: "#38bdf8",
  ready: "#34d399",
  riding: "#818cf8",
  flow: "#818cf8",
  recovery: "#38bdf8",
  celebrate: "#fbbf24",
  fatigued: "#fb7185",
};

function JourneyContent() {
  const searchParams = useSearchParams();
  const [rides, setRides] = useState<RideSummary[]>(() => getRideHistory());
  const [leaderboard, setLeaderboard] = useState<LeaderboardSnapshot | null>(
    null,
  );
  const [walrusFeed, setWalrusFeed] = useState<WalrusFeedEntry[]>([]);
  const [walrusLoaded, setWalrusLoaded] = useState(false);
  const { address } = useAccount();
  const isCompletedLanding = searchParams.get("completed") === "true";

  useProfileSyncEffect();
  useSupabaseSync();

  const retention = useMemo(() => getRetentionSignals(rides), [rides]);
  const prs = useMemo(() => getPRs(rides), [rides]);
  const badges = useMemo(() => getBadges(rides), [rides]);
  const latestClassId = rides[0]?.classId ?? "";

  // The room's atmosphere: the rider's persisted theme preference (defaults
  // to neon), kept static and quiet behind everything else.
  const [themeName] = useState(() =>
    typeof window === "undefined"
      ? "neon"
      : experienceManager.getProfile().preferredTheme,
  );
  const roomTheme = useMemo(() => getTheme(themeName), [themeName]);

  const legacyEnabled = isLegacyRewardClaimsEnabled();

  const totalSpin = useMemo(
    () => rides.reduce((sum, r) => sum + r.spinEarned, 0),
    [rides],
  );
  const claimableSpin = useMemo(
    () =>
      rides
        .filter((r) => r.proof.status === "ready")
        .reduce((sum, r) => sum + r.spinEarned, 0),
    [rides],
  );

  // Raw proof-type labels, surfaced only inside the verification disclosure.
  const proofTypeLegend = useMemo(() => {
    const types = new Set<string>();
    leaderboard?.entries.forEach((entry) => {
      if (entry.proofType !== "none") types.add(entry.proofType);
    });
    rides.forEach((ride) => {
      if (ride.proof.mode !== "none") types.add(ride.proof.mode);
    });
    return Array.from(types);
  }, [leaderboard, rides]);

  const coachPersonality = useRiderProfile((s) => s.coachPersonality);
  // The between-ride act: the coach speaks to the rider's arc from real
  // history + memory. Local cache only (Walrus blobs are unlistable).
  const coachArc = useMemo(() => {
    const memory = listCachedCoachMemories(address ?? "guest")[0] ?? null;
    // A remembered coach keeps their own voice (coachId "Name:personality");
    // the rider's profile preference only applies when nothing is remembered.
    const remembered = memory?.coachId.split(":")[1];
    const personality =
      remembered === "zen" || remembered === "drill-sergeant" || remembered === "data"
        ? remembered
        : mapCoachPersonalityToEngine(coachPersonality);
    return composeCoachArc({
      rides,
      memory,
      personality,
      coachName: memory ? memory.coachId.split(":")[0] : "Your coach",
    });
  }, [rides, address, coachPersonality]);

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
    if (streak >= 1) return { label: "Base rate", description: "Ride 3+ days in a row to unlock a streak bonus." };
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
    getWalrusFeed(address)
      .then((feed) => {
        setWalrusFeed(feed);
        setWalrusLoaded(true);
      })
      .catch(() => setWalrusLoaded(true));
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
    window.addEventListener(RIDE_HISTORY_UPDATED_EVENT, handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(RIDE_HISTORY_UPDATED_EVENT, handleStorage);
    };
  }, []);

  // One-line factual summaries for the collapsed section headers ("—" when
  // there is nothing to report).
  const weekSummary =
    rides.length === 0
      ? "—"
      : `${retention.weeklyGoal.completedRides}/${retention.weeklyGoal.targetRides} rides this week` +
        (retention.streaks.daily > 0
          ? ` · ${retention.streaks.daily}-day streak`
          : "");
  const rewardsSummary =
    rides.length === 0
      ? "—"
      : legacyEnabled
        ? `${totalSpin.toFixed(1)} SPIN earned` +
          (claimableSpin > 0 ? ` · ${claimableSpin.toFixed(1)} SPIN to claim` : "")
        : `${rides.length} ride record${rides.length === 1 ? "" : "s"} · no redemption available`;
  const historySummary =
    rides.length === 0
      ? "—"
      : `${rides.length} ride${rides.length === 1 ? "" : "s"} · ${badges.length} badge${badges.length === 1 ? "" : "s"} · last ${new Date(rides[0].completedAt).toLocaleDateString()}`;

  return (
    <div
      className="min-h-screen bg-black"
      style={{
        backgroundImage: `linear-gradient(180deg, ${roomTheme.skyTop}2e 0%, ${roomTheme.skyBottom}17 45%, #000000 100%)`,
      }}
    >
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-white/10 bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        {isCompletedLanding && (
          <div
            className={`flex items-center gap-4 rounded-2xl px-6 py-4 ${chipToneClasses("emerald")}`}
          >
            <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">
                Ride complete — part of your story now.
              </p>
              <p className="mt-1 text-sm opacity-80">
                Your latest ride has been added to your journey history.
              </p>
            </div>
          </div>
        )}

        {/* The coach at the center of the room — and the one obvious next action. */}
        <section aria-label="Your coach" className="flex flex-col gap-6">
          <CoachArcCard arc={coachArc} />
          <div className="flex flex-col items-center gap-4">
            <Link
              href="/rider"
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--accent)] px-6 py-3 text-sm font-semibold text-black transition-[transform,background-color] duration-150 hover:bg-[color:var(--accent-strong)] active:scale-95 motion-reduce:transition-none"
            >
              <Bike className="h-4 w-4" />
              Ride
            </Link>
            <div
              aria-hidden
              className="h-px w-16"
              style={{ backgroundColor: `${STATE_ACCENT[coachArc.state]}59` }}
            />
          </div>
        </section>

        {/* Form strip — one quiet row, no card boxes. */}
        <section aria-label="Your form" className="flex flex-col gap-3">
          <div className="flex items-stretch divide-x divide-white/10 overflow-x-auto">
            <FormStat label="Total rides" value={String(rides.length)} />
            <FormStat
              label="Daily streak"
              value={rides.length === 0 ? "—" : `${retention.streaks.daily} days`}
            />
            <FormStat
              label="Weekly streak"
              value={rides.length === 0 ? "—" : `${retention.streaks.weekly} weeks`}
            />
            <FormStat
              label="Best effort"
              value={rides.length === 0 ? "—" : `${prs.bestEffort}`}
            />
          </div>
          <p className="text-xs text-white/60">
            Effort points (out of 1000) are based on your average heart rate for the ride.
          </p>
        </section>

        {/* The walls — folded until asked. */}
        <div className="border-b border-white/10">
          <RoomSection title="Your week" summary={weekSummary}>
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
          </RoomSection>

          <RoomSection title="Rewards" summary={rewardsSummary}>
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
                      Rewards
                    </h3>
                    <p className="text-xs text-yellow-500/60 font-bold uppercase tracking-widest">
                      From your rides
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-5 rounded-3xl bg-black/40 border border-white/5">
                    {legacyEnabled ? (
                      <>
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] block mb-2">
                          Total Earned
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-white tracking-tighter">
                            {totalSpin.toFixed(1)}
                          </span>
                          <span className="text-xs font-bold text-yellow-500 uppercase">
                            SPIN
                          </span>
                        </div>
                        <p className="mt-2 text-[10px] text-white/40 font-medium">
                          SPIN — what your effort earns.
                        </p>
                        {claimableSpin > 0 ? (
                          <p className="mt-2 text-[10px] font-bold text-yellow-400/90">
                            {claimableSpin.toFixed(1)} SPIN unclaimed — claims are
                            available on the ride finish screen. Claim recovery
                            from history is not available yet.
                          </p>
                        ) : (
                          <p className="mt-2 text-[10px] text-white/40 font-medium">
                            Rewards are claimed on the ride finish screen.
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] block mb-2">
                          Ride Records
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-white tracking-tighter">
                            {rides.length}
                          </span>
                          <span className="text-xs font-bold text-yellow-500 uppercase">
                            completed
                          </span>
                        </div>
                        <p className="mt-2 text-[10px] text-white/40 font-medium">
                          Each completed ride saves a record on this device.
                          Ride records are not independently verified and no
                          redemption is available.
                        </p>
                      </>
                    )}
                  </div>

                  <div className="p-5 rounded-3xl bg-black/40 border border-white/5">
                    <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] block mb-2">
                      Effort Tier
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
                      <span
                        className={`text-3xl font-black tracking-tighter ${
                          multiplier.label === "Base rate" ? "text-white" : "text-emerald-400"
                        }`}
                      >
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
          </RoomSection>

          <RoomSection title="History" summary={historySummary}>
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
                      Complete your first class to start building your journey history with stats, badges, and rewards.
                    </p>
                    <Link
                      href="/rider"
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[color:var(--accent)] text-black text-xs font-semibold transition-[transform,background-color] duration-150 active:scale-95 hover:bg-[color:var(--accent-strong)]"
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
                            <span
                              className={`rounded-full px-2 py-1 font-semibold ${getStatusToneClasses(getRideAnchoringStatus(ride).tone)}`}
                            >
                              {getRideAnchoringStatus(ride).label}
                            </span>
                            {legacyEnabled && ride.proof.mode !== "none" ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-white/60">
                                {ride.proof.isVerified ? "Verified ✓" : "Pending"}
                              </span>
                            ) : null}
                            {legacyEnabled && ride.proof.verifiedScore ? (
                              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-cyan-200">
                                {ride.proof.verifiedScore} effort verified
                              </span>
                            ) : null}
                            {!legacyEnabled && ride.receipt && (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-white/50">
                                Not independently verified
                              </span>
                            )}
                            {ride.receipt && (
                              <RedeemPilotChip
                                rideId={ride.id}
                                durationSec={ride.durationSec}
                              />
                            )}
                          </div>
                        </div>
                        <div className="text-right text-xs text-white/70">
                          <p>{ride.avgEffort} effort</p>
                          {legacyEnabled && <p>{ride.spinEarned.toFixed(1)} SPIN</p>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
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
                  {Math.round(prs.bestDuration / 60)}m
                  {legacyEnabled && (
                    <> • PR SPIN: {prs.bestSpin.toFixed(1)}</>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-bold text-white">Class Leaderboard</h3>
                <p className="mt-1 text-xs text-white/50">
                  {legacyEnabled
                    ? "Ranked by verified effort from completed rides."
                    : "Ranked by effort from completed rides."}
                </p>
                {legacyEnabled && (
                <details className="group mt-3">
                  <summary className="cursor-pointer text-xs text-white/50 hover:text-white/70">
                    How verification works
                  </summary>
                  <div className="mt-2 space-y-1.5 text-xs leading-relaxed text-white/50">
                    <p>
                      Each ride is verified by a cryptographic proof generated on your device, so your effort counts without sharing your raw ride data.
                    </p>
                    <p>
                      &quot;Pending&quot; means the proof is still being submitted; it becomes &quot;Verified ✓&quot; once confirmed.
                    </p>
                    {proofTypeLegend.length > 0 && (
                      <p className="text-white/30">
                        {proofTypeLegend.includes("zk")
                          ? "This ride uses zero-knowledge verification — the math proves your effort without revealing anything else."
                          : "Each ride is checked by a cryptographic proof — it confirms your effort without exposing your raw ride data."}
                      </p>
                    )}
                  </div>
                </details>
                )}
                <div className="mt-4 space-y-2">
                  {leaderboard === null ? (
                    <QuietPlaceholder />
                  ) : leaderboard.entries.length === 0 ? (
                    <p className="text-sm text-white/60">
                      No leaderboard entries yet.
                    </p>
                  ) : (
                    leaderboard.entries.map((entry) => (
                      <div
                        key={`${entry.rank}-${entry.riderLabel}`}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80"
                      >
                        <span>
                          #{entry.rank} {entry.riderLabel}
                        </span>
                        <span>
                          {entry.effort} effort •{" "}
                          {entry.verified ? "Verified ✓" : "Pending"}
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
                    Saved Sessions
                  </h3>
                  <p className="text-xs text-white/40 italic">
                    Your completed ride summaries.
                  </p>
                </div>
                <ShieldCheck className="w-5 h-5 text-emerald-400 opacity-50" />
              </div>

              <div className="space-y-3">
                {!walrusLoaded ? (
                  <QuietPlaceholder />
                ) : walrusFeed.length === 0 ? (
                  <p className="text-sm text-white/50 italic">
                    No saved sessions yet. Complete a ride to save your first summary.
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
                        <span className="text-[10px] text-white/40">
                          Saved ride summary
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] text-white/40">
                          {new Date(item.completedAt).toLocaleDateString()}
                        </span>
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                          saved
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </RoomSection>

          <RoomSection title="Training" summary="Analysis, plan & homework">
            {/* AI Ride Analysis */}
            <RideAnalysisCard />

            {/* AI Training Plan */}
            <TrainingPlanCard />

            {/* Homework from coach */}
            <RiderHomeworkCard />
          </RoomSection>

          <RoomSection title="Data & settings" summary="Storage, export & privacy">
            <DataOwnershipDashboard />
          </RoomSection>
        </div>
      </main>
    </div>
  );
}

function FormStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="shrink-0 px-6 py-1 first:pl-0">
      <p className="text-2xl font-bold tabular-nums text-white">{value}</p>
      <p className="mt-0.5 text-xs text-white/60">{label}</p>
    </div>
  );
}

/** A wall of the room: collapsed by default, summary line always visible. */
function RoomSection({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-t border-white/10">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <span className="text-sm text-white/60">{summary}</span>
        </div>
        <ChevronDown className="h-5 w-5 shrink-0 text-white/50 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="flex flex-col gap-6 pb-6 pt-2">{children}</div>
    </details>
  );
}

/** Quiet stand-in for async content that pops in (leaderboard, walrus feed). */
function QuietPlaceholder() {
  return (
    <div className="space-y-2 py-1" aria-hidden>
      <div className="h-3 w-3/5 rounded bg-white/5 motion-safe:animate-pulse" />
      <div className="h-3 w-2/5 rounded bg-white/5 motion-safe:animate-pulse" />
    </div>
  );
}

function getStatusToneClasses(
  tone: "neutral" | "cyan" | "emerald" | "amber" | "red",
) {
  return chipToneClasses(tone);
}

export default function RiderJourneyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <JourneyContent />
    </Suspense>
  );
}
