"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { PrimaryNav } from "../components/layout/nav";
import {
  useClasses,
  type ClassWithRoute,
  getDemoRideUrl,
} from "../hooks/evm/use-class-data";
import { useInstructors } from "../hooks/evm/use-instructors";
import Link from "next/link";
import { RoutePreviewCard } from "../components/features/route/route-preview-card";
import { ConnectWallet } from "../components/features/wallet/connect-wallet";
import { AnimatedClassCard } from "../components/features/class/animated-class-card";
import { EmptyState } from "../components/features/common/empty-state";
import { RiderHero } from "../components/features/rider/rider-hero";
import { GamificationBar } from "../components/features/common/gamification-bar";
import { PrimaryCTA } from "../components/features/common/primary-cta";
import { useMilestones } from "../lib/milestones";
import { useToast } from "../components/ui/toast";
import { Bike, CalendarClock, ChevronDown, ChevronUp } from "lucide-react";
import type { SavedRoute } from "../lib/route-library";

export default function RiderPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { classes, isLoading, error } = useClasses();
  const { instructors } = useInstructors();
  const { streak, totalRides, bestMaxPower, totalFlowMinutes } = useMilestones();
  const [selectedRoute, setSelectedRoute] = useState<SavedRoute | null>(null);
  const [filterUpcoming, setFilterUpcoming] = useState(true);
  const [showClasses, setShowClasses] = useState(false);
  const toast = useToast();

  // Hero greeting based on gamification state
  const heroGreeting = totalRides === 0
    ? "Ready to ride?"
    : streak > 0
      ? `Good to see you — ${streak} day streak 🔥`
      : totalFlowMinutes > 30
        ? `You've logged ${totalFlowMinutes}m in flow — time to build on that?`
        : "Ready for your ride?";

  useEffect(() => {
    if (error) toast.error("Couldn't load classes", error);
  }, [error, toast]);

  // Filter classes by time
  const [filteredClasses, setFilteredClasses] =
    useState<ClassWithRoute[]>(classes);
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const now = Math.floor(Date.now() / 1000);
      setFilteredClasses(
        classes.filter((cls) =>
          filterUpcoming ? cls.startTime > now : cls.startTime <= now,
        ),
      );
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [classes, filterUpcoming]);

  const handlePreviewRoute = (classData: ClassWithRoute) => {
    if (classData.route) {
      const routeForPreview: SavedRoute = {
        id: classData.address,
        name: classData.route.route.name,
        description: classData.route.route.description,
        coordinates: classData.route.route.coordinates,
        estimatedDistance: classData.route.route.estimatedDistance,
        estimatedDuration: classData.route.route.estimatedDuration,
        elevationGain: classData.route.route.elevationGain,
        elevationLoss: classData.route.route.elevationLoss ?? 0,
        maxElevation: classData.route.route.maxElevation ?? 0,
        minElevation: classData.route.route.minElevation ?? 0,
        avgGrade: classData.route.route.avgGrade ?? 0,
        maxGrade: classData.route.route.maxGrade ?? 0,
        storyBeats: classData.route.route.storyBeats,
        terrainTags: classData.route.route.terrainTags ?? [],
        difficultyScore: classData.route.route.difficultyScore ?? 50,
        estimatedCalories: classData.route.route.estimatedCalories ?? 400,
        zones: classData.route.route.zones ?? [],
        savedAt: classData.route.deployment.deployedAt,
        author: classData.instructor,
        tags: [],
        isFavorite: false,
        timesUsed: 0,
      };
      setSelectedRoute(routeForPreview);
    }
  };

  // Get first upcoming class name for the CTA
  const nextClass = filteredClasses.find(
    (cls) => cls.startTime > Math.floor(Date.now() / 1000)
  );
  const nextClassName = nextClass ? nextClass.name : undefined;

  const featuredInstructors = instructors.length > 0 ? instructors.map(i => ({
    ...i,
    href: `/agent?coach=${i.name.toLowerCase().replace(/\s+/g, '')}`
  })) : [
    {
      name: "Coach Atlas",
      role: "Endurance Specialist",
      icon: "🏔️",
      color: "from-blue-500 to-cyan-500",
      rating: "4.9",
      rides: "1.2k",
      specialty: "Alpine routes & sustained climbs",
      agenticPowers: ["W'bal optimization", "FTP tracking", "Zone-based pacing"],
      href: "/agent?coach=atlas",
    },
    {
      name: "Dr. Spin",
      role: "High-Intensity Lead",
      icon: "⚡",
      color: "from-amber-500 to-orange-500",
      rating: "5.0",
      rides: "850",
      specialty: "HIIT intervals & sprints",
      agenticPowers: ["Real-time resistance", "Sprint analytics", "Interval engineering"],
      href: "/agent?coach=drspin",
    },
    {
      name: "Zen Master",
      role: "Mindful Recovery",
      icon: "🧘",
      color: "from-emerald-500 to-teal-500",
      rating: "4.8",
      rides: "2.1k",
      specialty: "Flow state & recovery rides",
      agenticPowers: ["HRV adaptation", "Recovery scoring", "Breath sync"],
      href: "/agent?coach=zenmaster",
    },
  ];

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      {/* Background gradient - adapts to theme */}
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-20 pt-10 lg:px-12">
        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)]/80 px-8 py-10 backdrop-blur">
          <PrimaryNav />
        </div>

        {/* 1. Gamification Bar — visible game signals on the front door */}
        <GamificationBar />

        {/* 2. Hero — personalized greeting */}
        <RiderHero initialGreeting={heroGreeting} />

        {/* 3. ONE Primary CTA — the dominant action */}
        <PrimaryCTA isConnected={isConnected} nextClassName={nextClassName} />

        {/* 4. Browse All Classes — collapsed by default, pushed below the fold */}
        <div id="classes" className="scroll-mt-8">
          <button
            onClick={() => setShowClasses(!showClasses)}
            className="flex w-full items-center justify-between gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/60 px-6 py-4 text-left backdrop-blur transition-colors hover:bg-[color:var(--surface)]"
          >
            <div>
              <h2 className="text-lg font-bold text-[color:var(--foreground)]">
                {totalRides === 0 ? "Explore available rides" : "Browse all classes"}
              </h2>
              <p className="mt-0.5 text-sm text-[color:var(--muted)]">
                {filteredClasses.length} {filterUpcoming ? "upcoming" : "past"}{" "}
                rides with immersive 3D routes
              </p>
            </div>
            {showClasses ? (
              <ChevronUp className="h-5 w-5 text-[color:var(--muted)]" />
            ) : (
              <ChevronDown className="h-5 w-5 text-[color:var(--muted)]" />
            )}
          </button>

          {/* Expanded content */}
          {showClasses && (
            <div className="mt-6 space-y-6">
              {/* Filter tabs */}
              <div className="flex gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-1 w-fit">
                <button
                  onClick={() => setFilterUpcoming(true)}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                    filterUpcoming
                      ? "bg-[color:var(--accent)] text-white"
                      : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                  }`}
                >
                  Upcoming
                </button>
                <button
                  onClick={() => setFilterUpcoming(false)}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                    !filterUpcoming
                      ? "bg-[color:var(--accent)] text-white"
                      : "text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                  }`}
                >
                  Past
                </button>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="h-12 w-12 mx-auto animate-spin rounded-full border-4 border-[color:var(--border)] border-t-[color:var(--accent)] mb-4" />
                    <p className="text-[color:var(--muted)]">Loading classes...</p>
                  </div>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    {error}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    Showing curated classes instead. Try refreshing in a moment.
                  </p>
                </div>
              )}

              {/* Classes Grid */}
              {!isLoading && !error && filteredClasses.length > 0 && (
                <div className="grid gap-6 md:grid-cols-2">
                  {filteredClasses.map((classData, index) => {
                    const themes: ("neon" | "alpine" | "mars" | "ocean")[] = [
                      "neon",
                      "alpine",
                      "mars",
                      "ocean",
                    ];
                    const metadataTheme = classData.metadata?.route?.theme;
                    const theme = metadataTheme === "neon" || metadataTheme === "alpine" || metadataTheme === "mars"
                      ? metadataTheme
                      : themes[index % themes.length];

                    return (
                      <AnimatedClassCard
                        key={classData.address}
                        classData={classData}
                        isConnected={isConnected}
                        onPreview={() => handlePreviewRoute(classData)}
                        onJoin={() => router.push(`/rider/ride/${classData.address}`)}
                        theme={theme}
                      />
                    );
                  })}
                </div>
              )}

              {/* Empty State */}
              {!isLoading && !error && filteredClasses.length === 0 && (
                <EmptyState
                  icon={filterUpcoming ? CalendarClock : Bike}
                  title={filterUpcoming ? "No upcoming rides yet" : "No past rides yet"}
                  description={filterUpcoming
                    ? "New rides are added every day. Be the first to host one, or try a demo ride in the meantime."
                    : "Your completed rides will appear here with full telemetry and reward history."
                  }
                  action={!isConnected ? {
                    label: "Try Demo Ride",
                    href: getDemoRideUrl(),
                  } : undefined}
                />
              )}
            </div>
          )}
        </div>

        {/* Route Preview Modal */}
        {selectedRoute && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setSelectedRoute(null)}
          >
            <div
              className="w-full max-w-2xl max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <RoutePreviewCard route={selectedRoute} variant="detailed" />
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setSelectedRoute(null)}
                  className="flex-1 py-3 rounded-xl bg-[color:var(--surface-strong)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-elevated)] transition-colors"
                >
                  Close Preview
                </button>
                {!isConnected && (
                  <div className="flex-1">
                    <ConnectWallet />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Coach profiles — below classes so the primary action comes first */}
        <section className="space-y-6 pt-6">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black text-[color:var(--foreground)] tracking-tighter">
                Meet your coaches
              </h2>
              <p className="text-sm text-[color:var(--muted)] font-medium">
                AI-powered coaches to match your goals.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {featuredInstructors.map((coach) => (
              <a
                key={coach.name}
                href={coach.href}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 text-left transition-[background-color,border-color] duration-200 hover:bg-white/10 hover:border-white/20"
              >
                <div
                  className={`absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-gradient-to-br ${coach.color} opacity-20 blur-2xl transition-transform group-hover:scale-150`}
                />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-3xl">{coach.icon}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      AI-Powered
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{coach.name}</h3>
                  <p className="text-xs text-white/50 mb-2">{coach.role}</p>
                  <p className="text-xs text-white/40 italic mb-3">
                    {coach.specialty}
                  </p>
                  <div className="flex flex-wrap gap-1 mb-4">
                    {coach.agenticPowers.slice(0, 2).map((power) => (
                      <span
                        key={power}
                        className="text-[9px] font-medium text-white/30 bg-white/5 px-2 py-0.5 rounded"
                      >
                        {power}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-400">★</span>
                      <span className="text-[10px] font-bold text-white/80">
                        {coach.rating}
                      </span>
                    </div>
                    <div className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">
                      {coach.rides} Rides
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Guest Mode Banner — only shown when disconnected */}
        {!isConnected && (
          <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="text-lg">👤</span>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-amber-700 dark:text-amber-300">
                  Browsing as guest
                </span>
                <span className="text-amber-600/60 dark:text-amber-400/60">
                  ·
                </span>
                <span className="text-amber-600/80 dark:text-amber-400/80 hidden sm:inline">
                  Try a free demo ride — no wallet needed
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={getDemoRideUrl()}
                className="text-xs font-medium px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/30 transition"
              >
                Try Demo
              </Link>
              <ConnectWallet />
            </div>
          </div>
        )}

        {/* Connected wallet summary */}
        {isConnected && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  Wallet connected
                </p>
                <p className="text-xs text-[color:var(--muted)] mt-0.5">
                  You can join classes and earn rewards
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}