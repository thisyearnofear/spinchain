"use client";

import { PrimaryNav } from "@/app/components/layout/nav";
import { CoachyMascot } from "@/app/components/ui/coachy-mascot";
import {
  useRiderProfile,
  COACH_LABELS,
  getRecommendedDifficulty,
  getRecommendedDuration,
  mapCoachPersonalityToEngine,
  getRecommendedRideName,
} from "@/app/stores/rider-profile-store";
import { getRideHistory, getStreakStats, getPRs } from "@/app/lib/analytics/ride-history";
import { getDemoRideUrl } from "@/app/hooks/evm/use-class-data";
import { useAccount } from "wagmi";
import { useProfile, getDisplayName } from "@/app/hooks/common/use-profile";
import Link from "next/link";
import { useMemo } from "react";
import { Flame, Trophy, Bike, Zap } from "lucide-react";

export function PersonalizedHero() {
  const profile = useRiderProfile();
  const { address } = useAccount();
  const { profile: ensProfile } = useProfile(address);

  const riderName = useMemo(() => {
    if (ensProfile) return getDisplayName(ensProfile, address ?? "");
    if (address) return `${address.slice(0, 6)}…${address.slice(-4)}`;
    return "Rider";
  }, [ensProfile, address]);

  const { totalRides, streak, prs } = useMemo(() => {
    const rides = getRideHistory();
    return {
      totalRides: rides.length,
      streak: getStreakStats(rides),
      prs: getPRs(rides),
    };
  }, []);

  const isFirstTime = totalRides === 0;
  const difficulty = getRecommendedDifficulty(profile);
  const duration = getRecommendedDuration(profile);
  const rideName = getRecommendedRideName(difficulty);
  const coachEngine = mapCoachPersonalityToEngine(profile.coachPersonality ?? null);
  const demoUrl = getDemoRideUrl({
    name: rideName,
    duration,
    coachPersonality: coachEngine,
  });

  const greeting = isFirstTime ? "Welcome aboard" : "Welcome back";

  return (
    <header className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-6 py-6 shadow-[0_20px_80px_rgba(0,0,0,0.15)] backdrop-blur md:gap-8 md:px-8 md:py-8">
      <PrimaryNav />

      <div className="relative w-full overflow-hidden border-y border-[color:var(--border)] py-8 md:py-10">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 bg-[color:var(--accent)]/5 blur-[120px]" />

        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-4">
            <CoachyMascot mood={isFirstTime ? "cheering" : "welcoming"} size={72} />
            <div className="text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--accent)] mb-1">
                {greeting}
              </p>
              <h1 className="text-2xl font-black text-[color:var(--foreground)] sm:text-3xl md:text-4xl leading-tight">
                {riderName}
              </h1>
            </div>
          </div>

          {isFirstTime ? (
            <div className="w-full max-w-md rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-4">
              <p className="text-sm text-indigo-200">
                Your journey starts here. Let&apos;s get you on the bike!
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
              <StatPill icon={<Flame className="w-4 h-4 text-orange-400" />} label="Streak" value={`${streak.daily}d`} highlight={streak.daily > 0} />
              <StatPill icon={<Bike className="w-4 h-4 text-indigo-400" />} label="Rides" value={totalRides.toString()} />
              <StatPill icon={<Zap className="w-4 h-4 text-yellow-400" />} label="Best Power" value={`${prs.bestPower}W`} />
              <StatPill icon={<Trophy className="w-4 h-4 text-emerald-400" />} label="Best Effort" value={`${prs.bestEffort}`} />
            </div>
          )}

          <div className="mt-2 w-full max-w-md rounded-2xl border border-[color:var(--accent)]/20 bg-[color:var(--accent)]/5 p-4">
            <p className="text-xs text-[color:var(--muted)] mb-2">
              {isFirstTime ? "Your first ride" : "Recommended for you"}
            </p>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎯</span>
                <div>
                  <p className="text-sm font-bold text-[color:var(--foreground)]">
                    {rideName}
                  </p>
                  <p className="text-xs text-[color:var(--muted)]">
                    {duration} min • {difficulty} • {profile.coachPersonality ? COACH_LABELS[profile.coachPersonality] : "Balanced"} coach
                  </p>
                </div>
              </div>
              <Link
                href={demoUrl}
                className="shrink-0 rounded-full bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-strong)] px-4 py-2 text-xs font-bold text-white transition-transform active:scale-95"
              >
                Ride →
              </Link>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/rider"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--border)] px-6 py-3 text-sm font-semibold text-[color:var(--foreground)] transition-colors hover:border-[color:var(--accent)]/50"
            >
              Browse classes
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            {!isFirstTime && (
              <Link
                href="/rider/journey"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--border)] px-6 py-3 text-sm font-semibold text-[color:var(--foreground)] transition-colors hover:border-[color:var(--accent)]/50"
              >
                View journey
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function StatPill({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${highlight ? "border-orange-400/30 bg-orange-500/10" : "border-white/10 bg-white/5"}`}>
      {icon}
      <span className="text-sm font-bold text-[color:var(--foreground)]">{value}</span>
      <span className="text-xs text-[color:var(--muted)]">{label}</span>
    </div>
  );
}
