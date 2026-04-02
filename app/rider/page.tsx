"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { PrimaryNav } from "../components/layout/nav";
import {
  useClasses,
  type ClassWithRoute,
  GUEST_DEMO_CLASS,
  getDemoRideUrl,
} from "../hooks/evm/use-class-data";
import Link from "next/link";
import { RoutePreviewCard } from "../components/features/route/route-preview-card";
import { ConnectWallet } from "../components/features/wallet/connect-wallet";
import { AnimatedClassCard } from "../components/features/class/animated-class-card";
import { OnboardingChecklist } from "../components/features/common/onboarding-checklist";
import type { SavedRoute } from "../lib/route-library";

export default function RiderPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { classes, isLoading, error } = useClasses();
  const [selectedRoute, setSelectedRoute] = useState<SavedRoute | null>(null);
  const [filterUpcoming, setFilterUpcoming] = useState(true);
  const [showGuestBanner, setShowGuestBanner] = useState(true);

  // Filter classes by time
  const [filteredClasses, setFilteredClasses] =
    useState<ClassWithRoute[]>(classes);
  useEffect(() => {
    // Use setTimeout to defer the state update and avoid sync setState warning
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

  const featuredInstructors = [
    {
      name: "Coach Atlas",
      role: "Endurance Specialist",
      icon: "🏔️",
      color: "from-blue-500 to-cyan-500",
      rating: "4.9",
      rides: "1.2k",
      specialty: "Alpine routes & sustained climbs",
      agenticPowers: [
        "W'bal optimization",
        "FTP tracking",
        "Zone-based pacing",
      ],
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
      agenticPowers: [
        "Real-time resistance",
        "Sprint analytics",
        "Interval engineering",
      ],
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

        {/* Airbnb-style Featured Section */}
        <section className="space-y-6">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black text-[color:var(--foreground)] tracking-tighter">
                Featured Coaches
              </h2>
              <p className="text-sm text-[color:var(--muted)] font-medium">
                Ride with the world&apos;s best virtual instructors.
              </p>
            </div>
            <button
              onClick={() => router.push("/instructor")}
              className="text-xs font-bold uppercase tracking-widest text-[color:var(--accent)] hover:underline"
            >
              View all →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {featuredInstructors.map((coach) => (
              <a
                key={coach.name}
                href={coach.href}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 text-left transition-all hover:bg-white/10 hover:border-white/20"
              >
                <div
                  className={`absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-gradient-to-br ${coach.color} opacity-20 blur-2xl transition-transform group-hover:scale-150`}
                />

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-3xl">{coach.icon}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      Agentic
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

        {/* Guest Mode Banner */}
        {!isConnected && showGuestBanner && (
          <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="text-lg">👤</span>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-amber-700 dark:text-amber-300">
                  Guest
                </span>
                <span className="text-amber-600/60 dark:text-amber-400/60">
                  ·
                </span>
                <span className="text-amber-600/80 dark:text-amber-400/80 hidden sm:inline">
                  Preview mode
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
              <button
                onClick={() => setShowGuestBanner(false)}
                className="p-1.5 rounded-lg text-amber-600/50 hover:text-amber-600 hover:bg-amber-500/10 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Demo Mode Info (when connected but no purchases) */}
        {isConnected && (
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/50 p-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[color:var(--muted)]">
                  Connected as {address?.slice(0, 6)}...{address?.slice(-4)}
                </p>
                <p className="text-xs text-[color:var(--muted)] mt-1">
                  Browse classes below and purchase tickets to start earning
                  SPIN
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[color:var(--foreground)]">
                  0
                </p>
                <p className="text-xs text-[color:var(--muted)]">
                  SPIN Balance
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Guest Demo Class */}
        {!isConnected && (
          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-6 backdrop-blur">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold">
                    FREE DEMO
                  </span>
                  <span className="text-2xl">🏔️</span>
                </div>
                <h2 className="text-2xl font-bold text-[color:var(--foreground)] mb-2">
                  {GUEST_DEMO_CLASS.name}
                </h2>
                <p className="text-[color:var(--muted)] mb-4">
                  {GUEST_DEMO_CLASS.description}
                </p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-[color:var(--muted)]">Duration:</span>
                    <span className="font-medium">
                      {GUEST_DEMO_CLASS.duration} min
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[color:var(--muted)]">
                      Elevation:
                    </span>
                    <span className="font-medium">
                      +{GUEST_DEMO_CLASS.elevationGain}m
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[color:var(--muted)]">
                      Difficulty:
                    </span>
                    <span className="font-medium capitalize">
                      {GUEST_DEMO_CLASS.difficulty}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  href={getDemoRideUrl()}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-500 text-white font-semibold hover:bg-green-600 transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Try Free Demo
                </Link>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400">
                    {GUEST_DEMO_CLASS.ticketsSold}
                  </p>
                  <p className="text-xs text-[color:var(--muted)]">
                    riders now
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Onboarding Checklist for new users */}
        <OnboardingChecklist />

        {/* Header with Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[color:var(--foreground)]">
              Available Classes
            </h1>
            <p className="mt-1 text-[color:var(--muted)]">
              {filteredClasses.length} {filterUpcoming ? "upcoming" : "past"}{" "}
              classes with immersive routes
            </p>
          </div>

          <div className="flex gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-1">
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
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Classes Grid */}
        {!isLoading && !error && filteredClasses.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            {filteredClasses.map((classData, index) => {
              // Assign theme based on index
              const themes: ("neon" | "alpine" | "mars" | "ocean")[] = [
                "neon",
                "alpine",
                "mars",
                "ocean",
              ];
              const theme = themes[index % themes.length];

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
          <div className="rounded-2xl border border-dashed border-[color:var(--border)] p-12 text-center">
            <p className="text-[color:var(--muted)]">
              No {filterUpcoming ? "upcoming" : "past"} classes
            </p>
          </div>
        )}

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
      </main>
    </div>
  );
}
