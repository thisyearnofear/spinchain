"use client";

import { useRef } from "react";
import { m, useScroll, useTransform } from "framer-motion";
import { AnimatedCard } from "@/app/components/ui/animated-card";
import { useClasses } from "@/app/hooks/evm/use-class-data";
import { getDemoRideUrl } from "@/app/hooks/evm/use-class-data";
import Link from "next/link";

const DIFFICULTY_THRESHOLDS = [
  { label: "Easy", maxElevation: 150, maxDuration: 40 },
  { label: "Medium", maxElevation: 400, maxDuration: 60 },
  { label: "Hard", maxElevation: 800, maxDuration: 90 },
  { label: "Extreme", maxElevation: Infinity, maxDuration: Infinity },
];

function deriveDifficulty(elevationM: number, durationMin: number): string {
  for (const t of DIFFICULTY_THRESHOLDS) {
    if (elevationM <= t.maxElevation && durationMin <= t.maxDuration) return t.label;
  }
  return "Extreme";
}

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: "bg-green-500/20 text-green-400 border-green-500/30",
  Medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Hard: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Extreme: "bg-red-500/20 text-red-400 border-red-500/30",
};

const THEME_IMAGES: Record<string, string> = {
  mountain: "/images/routes/route-mountain.jpg",
  neon: "/images/routes/route-city.jpg",
  alpine: "/images/routes/route-mountain.jpg",
  mars: "/images/routes/route-forest.jpg",
  city: "/images/routes/route-city.jpg",
  coastal: "/images/routes/route-coastal.jpg",
  forest: "/images/routes/route-forest.jpg",
  group: "/images/routes/route-group.jpg",
};

// Demo content shown when no on-chain classes exist
const DEMO_CLASSES = [
  {
    name: "Alpine Dawn",
    description: "Climb through misty mountain passes as the sun breaks through. A test of endurance with breathtaking views.",
    image: "/images/routes/route-mountain.jpg",
    difficulty: "Hard",
    duration: "45 min",
    distance: "18 km",
    elevation: "+420m",
    theme: "mountain" as const,
    instructor: "SpinChain Coaching",
  },
  {
    name: "Neon Grid Sprint",
    description: "High-intensity intervals through a cyberpunk cityscape. Sync your effort to the beat.",
    image: "/images/routes/route-city.jpg",
    difficulty: "Medium",
    duration: "30 min",
    distance: "12 km",
    elevation: "+80m",
    theme: "city" as const,
    instructor: "SpinChain Coaching",
  },
  {
    name: "Coastal Cruise",
    description: "Gentle rolling hills along the ocean. Perfect for recovery or beginners.",
    image: "/images/routes/route-coastal.jpg",
    difficulty: "Easy",
    duration: "60 min",
    distance: "25 km",
    elevation: "+150m",
    theme: "coastal" as const,
    instructor: "SpinChain Coaching",
  },
];

function RouteCard({ route, index }: { route: typeof DEMO_CLASSES[0]; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "end start"],
  });

  const imageY = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.9, 1, 1, 0.9]);
  const isEven = index % 2 === 0;

  return (
    <m.div
      ref={cardRef}
      style={{ opacity, scale }}
      className={`relative grid lg:grid-cols-2 gap-8 items-center ${isEven ? "" : "lg:grid-flow-dense"}`}
    >
      {/* Image Side */}
      <div className={`relative aspect-[16/10] rounded-3xl overflow-hidden ${isEven ? "" : "lg:col-start-2"}`}>
        <AnimatedCard className="h-full" glowColor="var(--accent)">
          <div className="relative h-full overflow-hidden">
            <m.div className="absolute inset-0" style={{ y: imageY }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={route.image}
                alt={route.name}
                className="w-full h-[120%] object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = "/images/routes/route-mountain.jpg"; }}
              />
            </m.div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4">
              <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur text-xs text-white/80 border border-white/10 capitalize">
                {route.theme}
              </span>
            </div>
          </div>
        </AnimatedCard>
      </div>

      {/* Content Side */}
      <div className={`space-y-6 ${isEven ? "" : "lg:col-start-1 lg:row-start-1"}`}>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${DIFFICULTY_COLORS[route.difficulty]}`}>
            {route.difficulty}
          </span>
        </div>

        <div>
          <h3 className="text-3xl lg:text-4xl font-bold text-[color:var(--foreground)] mb-3">
            {route.name}
          </h3>
          <p className="text-lg text-[color:var(--muted)] leading-relaxed">
            {route.description}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-[color:var(--surface-strong)] border border-[color:var(--border)]">
            <p className="text-2xl font-bold text-[color:var(--foreground)]">{route.duration}</p>
            <p className="text-xs text-[color:var(--muted)] uppercase tracking-wider">Duration</p>
          </div>
          <div className="p-4 rounded-2xl bg-[color:var(--surface-strong)] border border-[color:var(--border)]">
            <p className="text-2xl font-bold text-[color:var(--foreground)]">{route.distance}</p>
            <p className="text-xs text-[color:var(--muted)] uppercase tracking-wider">Distance</p>
          </div>
          <div className="p-4 rounded-2xl bg-[color:var(--surface-strong)] border border-[color:var(--border)]">
            <p className="text-2xl font-bold text-[color:var(--foreground)]">{route.elevation}</p>
            <p className="text-xs text-[color:var(--muted)] uppercase tracking-wider">Elevation</p>
          </div>
        </div>

        {/* Instructor + CTA */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-[color:var(--surface)] border border-[color:var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-strong)] flex items-center justify-center text-white text-sm font-bold">
              {route.instructor.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-[color:var(--foreground)]">{route.instructor}</p>
              <p className="text-xs text-[color:var(--muted)]">SpinChain Coach</p>
            </div>
          </div>
          <Link
            href={getDemoRideUrl({ name: route.name })}
            className="px-6 py-2.5 rounded-full bg-[color:var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Try it free
          </Link>
        </div>
      </div>
    </m.div>
  );
}

export function RouteShowcase() {
  const { classes: liveClasses } = useClasses();
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  // Use live on-chain classes when available; fall back to demo classes
  const isDemoMode = liveClasses.length === 0;

  return (
    <section ref={containerRef} className="relative">
      {/* Fixed Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-[color:var(--surface-strong)] z-50">
        <m.div
          className="h-full bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-strong)]"
          style={{ width: progressWidth }}
        />
      </div>

      {/* Header */}
      <div className="text-center mb-20">
        <m.span
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-block px-4 py-1.5 rounded-full bg-[color:var(--accent)]/10 text-[color:var(--accent)] text-sm font-medium mb-4"
        >
          {isDemoMode ? "Sample Rides" : "Live Classes"}
        </m.span>
        <m.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-4xl lg:text-5xl font-bold text-[color:var(--foreground)] mb-4"
        >
          Worlds to Explore
        </m.h2>
        <m.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-lg text-[color:var(--muted)] max-w-2xl mx-auto"
        >
          {isDemoMode
            ? "Try any of these routes free — no wallet or signup needed."
            : "Join live classes powered by real on-chain coaching."}
        </m.p>
      </div>

      {/* Routes */}
      <div className="space-y-32">
        {isDemoMode
          ? DEMO_CLASSES.map((route, index) => (
              <RouteCard key={route.name} route={route} index={index} />
            ))
          : liveClasses.map((cls, index) => {
              const meta = cls.metadata;
              const clsRoute = meta?.route;
              const difficulty = deriveDifficulty(
                Number(clsRoute?.elevationGain ?? 0),
                Number(clsRoute?.duration ?? meta?.duration ?? 30)
              );
              const displayRoute = {
                name: cls.name,
                description: meta?.description ?? "A SpinChain class ride.",
                image: THEME_IMAGES[clsRoute?.theme ?? "mountain"] ?? "/images/routes/route-mountain.jpg",
                difficulty,
                duration: `${clsRoute?.duration ?? meta?.duration ?? 30} min`,
                distance: `${clsRoute?.distance ?? 15} km`,
                elevation: `+${clsRoute?.elevationGain ?? 0}m`,
                theme: (clsRoute?.theme ?? "mountain") as typeof DEMO_CLASSES[0]["theme"],
                instructor: meta?.instructor ?? "SpinChain Coaching",
              };
              return <RouteCard key={cls.address} route={displayRoute} index={index} />;
            })}
      </div>

      {/* View All CTA */}
      <m.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mt-32"
      >
        <Link
          href="/routes"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-full border-2 border-[color:var(--accent)] text-[color:var(--accent)] font-semibold hover:bg-[color:var(--accent)] hover:text-white transition-all"
        >
          Explore All Routes
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
      </m.div>
    </section>
  );
}
