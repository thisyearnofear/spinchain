"use client";

import { PrimaryNav } from "../components/nav";
import RouteVisualizer from "../components/route-visualizer";
import {
  BulletList,
  GlassCard,
  GradientText,
  MetricTile,
  ProgressRing,
  SectionHeader,
  SurfaceCard,
  Tag,
} from "../components/ui";
import { useRiderSession, useClaimRewards } from "../hooks/use-rider-session";
import { useSuiTelemetry } from "../hooks/use-sui-telemetry";
import { useAccount } from "wagmi";
import { keccak256, encodePacked } from "viem";
import { useState } from "react";

export default function RiderPage() {
  const { address } = useAccount();
  const mockClassAddress = "0x0000000000000000000000000000000000000000"; // Dynamic in production

  const {
    purchaseTicket,
    attended,
    isPending: sessionPending,
    hash: sessionHash,
  } = useRiderSession(mockClassAddress as `0x${string}`);
  const {
    claimReward,
    isPending: claimPending,
    isSuccess: claimSuccess,
    error: claimError,
  } = useClaimRewards();

  // Sui Telemetry Bridge
  const [suiStatsId, setSuiStatsId] = useState<string | null>(null);
  const { updateTelemetry } = useSuiTelemetry(suiStatsId);

  const highlights = [
    { label: "Effort Proof", value: "145+ HR", detail: "28 min sustained" },
    { label: "Streak", value: "10 classes", detail: "Top 15% today" },
    { label: "Rewards", value: "50 SPIN", detail: "20% next ride" },
  ];

  const milestones = [
    "Verified effort proof stored onchain",
    "Discount unlocked for next class",
    "Shareable proof card generated",
    "Sponsor bonus applied automatically",
  ];

  // Mock elevation profile
  const elevation = [
    120, 140, 160, 150, 180, 210, 240, 220, 200, 230, 250, 280, 300, 280, 260,
    240, 270, 290, 310,
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a2550,transparent_55%),radial-gradient(circle_at_80%_20%,#2a1d5a,transparent_40%)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-white/10 bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        {/* Hero Section with Route Visualizer */}
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-2xl">
            <div className="absolute left-6 top-6 z-10">
              <GlassCard className="inline-block px-4 py-2">
                <p className="text-xs uppercase tracking-widest text-white/60">
                  Live Session
                </p>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                  <p className="font-semibold text-white">Alps Climb • 45m</p>
                </div>
              </GlassCard>
            </div>

            <RouteVisualizer
              elevationProfile={elevation}
              theme="alpine"
              progress={0.35}
              ghosts={[0.22, 0.45, 0.38, 0.31]}
              storyBeats={[
                { progress: 0.1, label: "Warmup Sprint", type: "sprint" },
                { progress: 0.45, label: "The Wall", type: "climb" },
                { progress: 0.7, label: "Peak Interval", type: "sprint" },
              ]}
              onStatsUpdate={(stats) => {
                if (suiStatsId) {
                  updateTelemetry(stats.hr, stats.power, stats.cadence);
                }
              }}
              className="h-[400px] w-full"
            />
          </div>

          <div className="flex flex-col gap-6">
            <GlassCard className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-cyan-500/5 border-cyan-500/20">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-bold">Sui Performance Node</span>
                <div className={`h-1.5 w-1.5 rounded-full ${suiStatsId ? 'bg-cyan-400 animate-pulse' : 'bg-white/20'}`} />
              </div>

              {!suiStatsId ? (
                <button
                  onClick={() => setSuiStatsId("0xTELEMETRY_MOCK")} // Mock ID for telemetry
                  className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/20"
                >
                  Enable Sui Telemetry
                </button>
              ) : (
                <div className="text-center">
                  <p className="text-[10px] font-mono text-cyan-400/60 mb-2 truncate max-w-[120px]">Stats ID: {suiStatsId}</p>
                  <p className="text-xs text-cyan-200">Live Telemetry Active</p>
                </div>
              )}
            </GlassCard>

            <GlassCard className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <p className="mb-4 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Effort Zone
              </p>
              <ProgressRing progress={82} size={140} color="#6ef3c6">
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-bold text-white">82%</span>
                  <span className="text-xs font-medium text-green-400">
                    Threshold
                  </span>
                </div>
              </ProgressRing>
              <div className="mt-6 space-y-1">
                <p className="text-lg font-semibold text-white">
                  HR 148 <span className="text-white/40">•</span> 32 min
                </p>
                <p className="text-xs text-[color:var(--success)]">
                  Verified locally, shared onchain
                </p>
              </div>
            </GlassCard>

            <SurfaceCard
              title="Class Access"
              className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40"
            >
              {!attended ? (
                <div className="space-y-4">
                  <p className="text-sm text-white/60">
                    You haven&apos;t joined this session yet. Purchase a ticket
                    to start tracking effort.
                  </p>
                  <button
                    onClick={() => purchaseTicket("0.02")}
                    disabled={sessionPending || !address}
                    className="w-full rounded-full bg-white py-2 text-sm font-bold text-slate-900 transition hover:bg-gray-100 disabled:opacity-50"
                  >
                    {sessionPending ? "Processing..." : "Join Class • 0.02 ETH"}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-400">
                    <span className="text-lg">✓</span>
                    <span className="text-sm font-bold uppercase tracking-wider">
                      Ticket Verified
                    </span>
                  </div>
                  <p className="text-xs text-white/50">
                    Your session is being tracked onchain.
                  </p>
                </div>
              )}
            </SurfaceCard>

            <SurfaceCard
              title="Next Reward"
              className="mt-6 bg-white/5 border-white/10"
            >
              <div className="mt-2 flex items-baseline gap-2">
                <GradientText className="text-3xl font-bold">
                  10 SPIN
                </GradientText>
                <span className="text-sm text-white/60">pending</span>
              </div>
              <p className="mt-2 text-sm text-white/60">
                Maintain &gt;75% effort for 5 more mins to unlock.
              </p>
            </SurfaceCard>
          </div>
        </section>

        {/* Progress & Stats */}
        <SurfaceCard
          eyebrow="Rider Progress"
          title="Effort proof + rewards in one feed"
          description="Only the proof is shared onchain. Health metrics stay on your device."
          className="bg-[color:var(--surface-strong)]"
        >
          <div className="mt-6 flex flex-wrap gap-3">
            <Tag>HR zone</Tag>
            <Tag>Privacy safe</Tag>
            <Tag>Auto rewards</Tag>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {highlights.map((item) => (
              <MetricTile key={item.label} {...item} />
            ))}
          </div>
        </SurfaceCard>

        {/* Post-Class Actions */}
        <SurfaceCard
          eyebrow="Post-Class"
          title="Proof card + shareable highlights"
          description="A single story for social + onchain verification."
        >
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    Proof Card
                  </p>
                  <h4 className="mt-2 text-xl font-semibold text-white">
                    45 min • 620 cal • Top 15%
                  </h4>
                </div>
                <div className="rounded-lg bg-white/10 p-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500" />
                </div>
              </div>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Linked to your instructor profile + reward history.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Tag>Onchain proof</Tag>
                <Tag>Share-ready</Tag>
              </div>
            </div>
            <SurfaceCard
              eyebrow="Milestones"
              title="What you just unlocked"
              className="bg-transparent !p-0 border-none"
            >
              <BulletList items={milestones} />
            </SurfaceCard>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/rider/journey"
              className="rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-white/70 transition hover:text-white"
            >
              View rider journey
            </a>
            <button className="rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-white/70 transition hover:text-white">
              Generate proof card
            </button>
            <button
              onClick={() => {
                const dummyClaim = keccak256(
                  encodePacked(["string"], ["EFFORT_SCORE_150"]),
                );
                claimReward({
                  spinClass: mockClassAddress as `0x${string}`,
                  rider: address as `0x${string}`,
                  rewardAmount: "10",
                  classId: keccak256(encodePacked(["string"], ["CLASS_123"])),
                  claimHash: dummyClaim,
                  timestamp: Math.floor(Date.now() / 1000),
                  signature: "0x00" as `0x${string}`, // Mock signature for MVP
                });
              }}
              disabled={claimPending || !attended}
              className="rounded-full bg-[linear-gradient(135deg,#6d7cff,#9b7bff)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:opacity-90 disabled:opacity-50"
            >
              {claimPending ? "Claiming..." : "Claim Rewards (10 SPIN)"}
            </button>
          </div>
          {(claimSuccess || claimError) && (
            <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10 text-sm">
              {claimSuccess && (
                <p className="text-green-400">
                  ✨ Rewards claimed successfully! Check your wallet for SPIN.
                </p>
              )}
              {claimError && (
                <p className="text-red-400">
                  ❌ Claim failed:{" "}
                  {claimError.message === "Mock signature for MVP"
                    ? "Invalid signature (MVP Demo)"
                    : claimError.message}
                </p>
              )}
            </div>
          )}
        </SurfaceCard>
      </main>
    </div>
  );
}
